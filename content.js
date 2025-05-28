// Content script for enhanced date extraction
(function() {
    'use strict';

    // Make the main extraction function async to handle potential waits
    async function enhancedDateExtraction() {
      const extractedData = {
        title: '',
        releaseDate: null,
        platform: detectPlatform(),
        confidence: 0,
        sourceText: '', // The larger block of text analyzed
        matchedContext: '', // The specific text snippet that matched the regex
        patternLabel: '' // The label of the pattern that matched
      };

      if (extractedData.platform === 'youtube') {
        await extractYouTubeData(extractedData);
      } else if (extractedData.platform === 'twitter') {
        extractTwitterData(extractedData);
      } else {
        extractGenericData(extractedData);
      }

      return extractedData;
    }

    function detectPlatform() {
      const hostname = window.location.hostname.toLowerCase();
      if (hostname.includes('youtube.com')) { // Ensure this matches your manifest's content script matches for YouTube
        return 'youtube';
      } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        return 'twitter';
      } else if (hostname.includes('instagram.com')) {
        return 'instagram';
      } else if (hostname.includes('tiktok.com')) {
        return 'tiktok';
      }
      return 'generic';
    }

    async function extractYouTubeData(data) {
      // Extract title
      const titleSelectors = [
        'h1.ytd-video-primary-info-renderer',
        'h1.title.style-scope.ytd-video-primary-info-renderer',
        'yt-formatted-string.style-scope.ytd-video-primary-info-renderer[force-default-style]',
        '#title h1 yt-formatted-string',
        '[data-title]',
        '.title'
      ];
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          data.title = element.textContent.trim();
          break;
        }
      }
      if (!data.title) {
        data.title = document.title.replace(' - YouTube', '');
      }

      // --- START: Logic to expand YouTube description ---
      try {
        const expanderSelectors = [
            'tp-yt-paper-button#expand.ytd-text-inline-expander',
            '#description-inline-expander > .ytd-video-secondary-info-renderer #button.ytd-text-inline-expander',
            '#description #expand-button button', // More generic
            '.ytd-video-secondary-info-renderer[collapsible] #more', // Check for collapsible attribute
            'ytm-expandable-item-renderer .expandable-item-button' // Mobile related, less likely but for completeness
        ];

        for (const selector of expanderSelectors) {
            const expandButton = document.querySelector(selector);
            // Check if button exists, is visible (offsetParent is not null), and is not explicitly hidden
            if (expandButton && expandButton.offsetParent !== null && !expandButton.hasAttribute('hidden')) {
                // More robust check: see if a "collapse" button is hidden or "Show more" text exists
                const collapseButtonSelector = selector.replace('expand', 'collapse').replace('more', 'less');
                const collapseButton = document.querySelector(collapseButtonSelector);

                if (!collapseButton || collapseButton.hasAttribute('hidden') || collapseButton.offsetParent === null) {
                    // console.log("Attempting to click 'Show more' button:", expandButton);
                    expandButton.click();
                    await new Promise(resolve => setTimeout(resolve, 750)); // Wait for content to load
                    // console.log("Description hopefully expanded.");
                    break; // Clicked one, assume it's enough
                }
            }
        }
      } catch (e) {
        console.warn("Error trying to expand description (might be already expanded or structure changed):", e);
      }
      // --- END: Logic to expand YouTube description ---

      const descriptionSelectors = [
        '#description-inline-expander yt-attributed-string.ytd-video-secondary-info-renderer > span',
        '#description.ytd-video-secondary-info-renderer .content',
        '#description-text', // More specific if available
        'ytd-text-inline-expander #content-text', // Newer structure
        '#description .ytd-text-inline-expander',
        'ytd-expander[slot="content"] #content.ytd-text-inline-expander',
        '#meta-contents .ytd-text-inline-expander',
        '#description.ytd-video-secondary-info-renderer yt-formatted-string.content' // After expansion
      ];

      let descriptionText = '';
      for (const selector of descriptionSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
            const tempText = element.textContent.trim();
            // Prefer longer text, assuming it's more complete after expansion
            if (tempText.length > descriptionText.length || descriptionText === '') {
                 descriptionText = tempText;
            }
        }
      }
      // General fallback for description if specific selectors didn't yield much
      if (descriptionText.length < 50) { // If very short, try a broader approach
          const descContainer = document.querySelector('#description.ytd-video-secondary-info-renderer');
          if (descContainer && descContainer.textContent.trim().length > descriptionText.length) {
              descriptionText = descContainer.textContent.trim();
          }
      }
      data.sourceText = descriptionText;

      if (descriptionText) {
        const foundDate = findReleaseDateInText(descriptionText);
        if (foundDate) {
          data.releaseDate = foundDate.date;
          data.confidence = foundDate.confidence;
          data.matchedContext = foundDate.context;
          data.patternLabel = foundDate.patternLabel;
        }
      }

      // If no date in description, check title (lower confidence)
      if (!data.releaseDate && data.title) {
        const titleDate = findReleaseDateInText(data.title);
        if (titleDate) {
          data.releaseDate = titleDate.date;
          data.confidence = titleDate.confidence * 0.8; // Lower confidence for title dates
          data.matchedContext = titleDate.context;
          data.patternLabel = titleDate.patternLabel;
        }
      }

      // Check comments for additional context (first few comments, lower confidence)
      if (!data.releaseDate || data.confidence < 0.7) {
        const comments = document.querySelectorAll('#content-text.ytd-comment-renderer'); // More specific selector
        for (let i = 0; i < Math.min(comments.length, 5); i++) {
          const commentText = comments[i].textContent;
          if (commentText) {
            const commentDate = findReleaseDateInText(commentText);
            // Only update if the new date has higher confidence than any existing date, or if no date yet
            if (commentDate && commentDate.confidence > (data.releaseDate ? data.confidence * 0.65 : 0)) { // Adjusted multiplier
              data.releaseDate = commentDate.date;
              data.confidence = commentDate.confidence * 0.6; // Lower confidence for comment dates
              data.matchedContext = commentDate.context;
              data.patternLabel = commentDate.patternLabel;
            }
          }
        }
      }
    }

    function extractTwitterData(data) {
        const tweetSelectors = [
            '[data-testid="tweetText"]',
            '.tweet-text',
            '.TweetTextSize'
          ];

          let tweetText = '';
          for (const selector of tweetSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              tweetText = element.textContent;
              data.title = tweetText.substring(0, 100) + (tweetText.length > 100 ? '...' : '');
              break;
            }
          }
          data.sourceText = tweetText;

          if (tweetText) {
            const foundDate = findReleaseDateInText(tweetText);
            if (foundDate) {
              data.releaseDate = foundDate.date;
              data.confidence = foundDate.confidence;
              data.matchedContext = foundDate.context;
              data.patternLabel = foundDate.patternLabel;
            }
          }
    }

    function extractGenericData(data) {
        data.title = document.title;
        const bodyText = document.body.innerText; // Get all visible text as a fallback
        data.sourceText = bodyText.substring(0, 5000); // Limit length for performance

        const foundDate = findReleaseDateInText(bodyText);
        if (foundDate) {
            data.releaseDate = foundDate.date;
            data.confidence = foundDate.confidence;
            data.matchedContext = foundDate.context;
            data.patternLabel = foundDate.patternLabel;
        }
    }

    function findReleaseDateInText(text, referenceDate = new Date()) {
        if (!text) return null;

        const results = [];
        const patterns = [
          // --- Highest Confidence: Keywords + Full Dates ---
          {
            regex: /(?:release\s+date|coming|launches|premieres|releases|available|out|ships|shipping|set\s+for|expected|due|in\s+theatres\s+from)\s*:?\s*(?:on\s+|in\s+|by\s+|around\s+|for\s+)?(?:the\s+)?([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/gi,
            confidence: 0.97, label: "Keyword + Full Date (Month Day, Year)"
          },
          { // NEW: For "Day Month, Year" with keywords
            regex: /(?:release\s+date|coming|launches|premieres|releases|available|out|ships|shipping|set\s+for|expected|due|in\s+theatres\s+from)\s*:?\s*(?:on\s+|in\s+|by\s+|around\s+|for\s+)?(?:the\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+\d{4})/gi,
            confidence: 0.97, label: "Keyword + Full Date (Day Month, Year)"
          },
          {
            regex: /([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\s+(?:is\s+the\s+)?(?:release\s+date|launch\s+date|premiere|set\s+for|coming)/gi,
            confidence: 0.96, label: "Full Date (Month Day, Year) + Keyword"
          },
          { // NEW: For "Day Month, Year" followed by keyword
            regex: /(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+\d{4})\s+(?:is\s+the\s+)?(?:release\s+date|launch\s+date|premiere|set\s+for|coming)/gi,
            confidence: 0.96, label: "Full Date (Day Month, Year) + Keyword"
          },
          {
            regex: /(?:release[sd]?|coming|available|launches|premieres|out|set\s+for|expected|due)\s+(?:on\s+|in\s+|by\s+)?(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{1,2}-\d{1,2})/gi,
            confidence: 0.92, label: "Keyword + Full Numeric Date (MM/DD/YYYY or YYYY-MM-DD)"
          },

          // --- Medium-High Confidence: Keywords + Partial Dates (Infer Year) ---
          { // NEW: Keyword + Day Month (Infer Year)
            regex: /(?:release[sd]?|coming|available|launches|premieres|out|set\s+for|expected|due|in\s+theatres\s+from)\s+(?:on\s+|in\s+|by\s+|around\s+|for\s+)?(?:the\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+)(?![\s,]*\d{4})/gi,
            confidence: 0.88, label: "Keyword + Day Month (Infer Year)",
            handler: (match, handlerReferenceDate = new Date()) => {
              let dateStr = match[1]; // e.g., "14th August"
              let year = handlerReferenceDate.getFullYear();
              // Add a space before the year if dateStr doesn't end with one and year needs to be appended.
              // The Date constructor is quite flexible: new Date("14th August 2025") works.
              let tempDate = new Date(`${dateStr} ${year}`);
              const currentMonth = handlerReferenceDate.getMonth(); // 0-11
              const tempDateMonth = tempDate.getMonth(); // 0-11

              // If the parsed month is earlier than current month (and it's same year), or if year parsed is less than current year
              // or if it's more than ~11 months in the past relative to current month.
              if (tempDate.getFullYear() < year ||
                  (tempDate.getFullYear() === year && tempDateMonth < currentMonth && (currentMonth - tempDateMonth > 1)) ) {
                  year++;
              }
              return `${dateStr}, ${year}`; // Ensure format is parseable by new Date()
            }
          },
          {
            regex: /(?:release[sd]?|coming|available|launches|premieres|out|set\s+for|expected|due)\s+(?:on\s+|in\s+|by\s+|around\s+|for\s+)?(?:the\s+)?([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?)(?![\s,]*\d{4})/gi,
            confidence: 0.87, label: "Keyword + Month Day (Infer Year)",
            handler: (match, handlerReferenceDate = new Date()) => {
              let dateStr = match[1]; // e.g., "August 14th"
              let year = handlerReferenceDate.getFullYear();
              let tempDate = new Date(`${dateStr}, ${year}`);
              const currentMonth = handlerReferenceDate.getMonth();
              const tempDateMonth = tempDate.getMonth();
              if (tempDate.getFullYear() < year ||
                  (tempDate.getFullYear() === year && tempDateMonth < currentMonth && (currentMonth - tempDateMonth > 1)) ) {
                  year++;
              }
              return `${dateStr}, ${year}`;
            }
          },
          {
            regex: /(?:release[sd]?|coming|available|launches|premieres|out)\s+(?:on\s+|in\s+|by\s+)?([A-Za-z]+\s+\d{4})/gi,
            confidence: 0.80, label: "Keyword + Month Year"
          },

          // --- Medium Confidence: Seasons & Quarters with Year ---
          {
            regex: /(Spring|Summer|Fall|Autumn|Winter)\s+(\d{4})/gi,
            confidence: 0.7, label: "Season Year",
            handler: (match) => {
              const season = match[1].toLowerCase();
              const year = match[2];
              const seasonDates = {
                spring: `${year}-03-20`, summer: `${year}-06-21`,
                fall: `${year}-09-22`, autumn: `${year}-09-22`,
                winter: `${year}-12-21`
              };
              return seasonDates[season];
            }
          },
          {
              regex: /(Q[1-4])\s*(?:of\s*)?(\d{4})/gi,
              confidence: 0.65, label: "Quarter Year",
              handler: (match) => {
                  const quarter = match[1].toUpperCase();
                  const year = match[2];
                  const quarterStartMonth = { 'Q1': '01', 'Q2': '04', 'Q3': '07', 'Q4': '10' };
                  return `${year}-${quarterStartMonth[quarter]}-01`;
              }
          },

          // --- Lower-Medium Confidence: Standalone Full Dates (No Keywords) ---
          { // Standalone Day Month, Year
            regex: /\b(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+\d{4})\b/g,
            confidence: 0.61, label: "Day Month, Year (Standalone)"
          },
          {
            regex: /\b([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/g,
            confidence: 0.60, label: "Month Day, Year (Standalone)"
          },
          {
            regex: /\b(\d{4}-\d{1,2}-\d{1,2})\b/g,
            confidence: 0.55, label: "YYYY-MM-DD (Standalone)"
          },
          {
            regex: /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g,
            confidence: 0.50, label: "MM/DD/YYYY (Standalone)"
          },

          // --- Lowest Confidence: Standalone Partial Dates ---
          {
            regex: /\b([A-Za-z]+\s+\d{4})\b/g,
            confidence: 0.35, label: "Month Year (Standalone)"
          }
        ];

        for (const pattern of patterns) {
          let match;
          // Create a new RegExp object for each iteration to reset lastIndex for global regexes
          const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

          while ((match = regex.exec(text)) !== null) {
            let dateStr;
            if (pattern.handler) {
              // Pass the correct referenceDate to the handler
              dateStr = pattern.handler(match, referenceDate);
            } else {
              // Ensure we're getting the main captured group if it exists, otherwise the whole match
              dateStr = match[1] || match[0];
            }

            const parsedDate = parseFlexibleDate(dateStr);
            if (parsedDate && isValidReleaseDate(parsedDate, referenceDate)) {
              results.push({
                date: parsedDate,
                confidence: pattern.confidence,
                context: match[0], // The full text matched by the regex for context
                patternLabel: pattern.label || "Unknown Pattern"
              });
            }
          }
        }

        if (results.length > 0) {
          // Sort by confidence, then by length of context if confidence is same (prefer more specific match)
          results.sort((a, b) => {
            if (b.confidence !== a.confidence) {
                return b.confidence - a.confidence;
            }
            return (b.context || '').length - (a.context || '').length; // Prefer longer context if confidence is equal
          });
          return results[0]; // Return the best result
        }
        return null;
    }

    function parseFlexibleDate(dateStr) {
        if (!dateStr) return null;

        // Remove ordinal indicators (st, nd, rd, th) from day numbers
        dateStr = dateStr.replace(/(\d+)(st|nd|rd|th)/g, '$1');

        let date;
        // Regex to check if dateStr is likely just "Month Year" (e.g., "August 2025")
        const monthYearOnlyRegex = /^[A-Za-z]+\s+\d{4}$/;
        // Regex to check if dateStr is in YYYY-MM-DD format (often from handlers)
        const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;

        if (ymdRegex.test(dateStr)) {
            const parts = dateStr.split('-');
            // Use Date.UTC to create a date object that represents UTC midnight
            // This avoids local timezone interpretation when we just have YYYY-MM-DD.
            date = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
        } else if (monthYearOnlyRegex.test(dateStr.trim())) {
            // If only month and year (e.g., "August 2025"), default to the 15th.
            date = new Date(dateStr + " 15"); // JS Date constructor handles "August 2025 15"
        } else {
            // For other formats (e.g., "August 14, 2025", "14 August 2025", "MM/DD/YYYY")
            // These are generally parsed relative to the local timezone at midnight.
            date = new Date(dateStr);
        }

        if (!isNaN(date.getTime())) {
            // If the date was created with Date.UTC, use getUTCFullYear, etc.
            // Otherwise, use getFullYear, etc., for dates that were parsed based on local time.
            let year, month, day;
            if (ymdRegex.test(dateStr) && dateStr === date.toISOString().split('T')[0]) { // Check if it was indeed a UTC date string
                year = date.getUTCFullYear();
                month = date.getUTCMonth() + 1;
                day = date.getUTCDate();
            } else { // Assume local interpretation was intended or resulted
                year = date.getFullYear();
                month = date.getMonth() + 1;
                day = date.getDate();
            }

            const monthStr = month < 10 ? '0' + month : month.toString();
            const dayStr = day < 10 ? '0' + day : day.toString();

            return `${year}-${monthStr}-${dayStr}`;
        }
        return null;
    }

    function isValidReleaseDate(dateStr, referenceDate = new Date()) {
        // dateStr is expected to be YYYY-MM-DD from parseFlexibleDate
        // Parse dateStr as UTC to avoid local timezone shifts during comparison.
        const date = new Date(dateStr + 'T00:00:00Z'); // Treat the YYYY-MM-DD as a UTC date
        if (isNaN(date.getTime())) return false;

        // Create 'today' as a UTC date for fair comparison
        const todayUTC = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()));

        const fiveYearsFromNow = new Date(todayUTC);
        fiveYearsFromNow.setUTCFullYear(todayUTC.getUTCFullYear() + 5);

        // Allow dates from a few days ago to account for timezones or slight past announcements
        const sevenDaysAgo = new Date(todayUTC);
        sevenDaysAgo.setUTCDate(todayUTC.getUTCDate() - 7);

        return date >= sevenDaysAgo && date <= fiveYearsFromNow;
    }

    // Make the function available globally for the popup script
    window.extractReleaseDateFromPage = async function() {
      return await enhancedDateExtraction();
    };

  })();