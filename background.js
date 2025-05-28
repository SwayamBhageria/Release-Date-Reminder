    // Background service worker for the extension
    chrome.runtime.onInstalled.addListener(function() {
        console.log('Release Date Reminder extension installed');
        
        // Set up context menu
        chrome.contextMenus.create({
          id: "extractReleaseDate",
          title: "Extract Release Date",
          contexts: ["page", "selection"]
        });
      });
      
      // Handle context menu clicks
      chrome.contextMenus.onClicked.addListener(function(info, tab) {
        if (info.menuItemId === "extractReleaseDate") {
          // Open the popup programmatically when context menu is clicked
          chrome.action.openPopup(); 
        }
      });
      
      // Handle messages from content scripts and popup
      chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === "extractFromSelection") {
          // Handle text selection extraction
          handleSelectionExtraction(request.text, sendResponse);
          return true; // Keep the message channel open for async response
        } else if (request.action === "createCalendarEvent") {
          // Handle calendar event creation (currently minimal)
          handleCalendarEvent(request.eventData, sendResponse);
          return true;
        }
      });
      
      async function handleSelectionExtraction(selectedText, sendResponse) {
        try {
          // Use the same date extraction logic as content script (simplified version here)
          const dateResult = findReleaseDateInText(selectedText);
          
          if (dateResult) {
            sendResponse({
              success: true,
              title: selectedText.substring(0, 100), // Send a snippet as title
              releaseDate: dateResult.date,
              confidence: dateResult.confidence
            });
          } else {
            sendResponse({
              success: false,
              error: "No release date found in selected text"
            });
          }
        } catch (error) {
          console.error("Error in handleSelectionExtraction:", error);
          sendResponse({
            success: false,
            error: error.message
          });
        }
      }
      
      async function handleCalendarEvent(eventData, sendResponse) {
        // This function is a placeholder if background needs to be involved.
        // Currently, popup.js handles Google Calendar directly.
        try {
          sendResponse({
            success: true,
            message: "Calendar event creation request received by background (currently handled by popup)"
          });
        } catch (error) {
          console.error("Error in handleCalendarEvent:", error);
          sendResponse({
            success: false,
            error: error.message
          });
        }
      }
      
      // Helper function to find dates in text (simplified version)
      function findReleaseDateInText(text) {
        if (!text) return null;
        
        // Simplified patterns from your uploaded background.js
        const patterns = [
          {
            regex: /(?:releases?|premieres?|launches?|available|comes?\s+out)\s+(?:on\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi,
            confidence: 0.9
          },
          {
            regex: /(?:release\s+date|coming)\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi,
            confidence: 0.95
          },
          {
            regex: /(Spring|Summer|Fall|Autumn|Winter)\s+(\d{4})/gi,
            confidence: 0.6
          }
          // Add more patterns here if needed for background script context menu
        ];
      
        for (const pattern of patterns) {
          // Iterate through all matches for global regexes
          let matchInstance;
          const regex = new RegExp(pattern.regex.source, pattern.regex.flags.includes('g') ? pattern.regex.flags : pattern.regex.flags + 'g'); // Ensure 'g' for exec loop
          while ((matchInstance = regex.exec(text)) !== null) {
            const dateStr = matchInstance[1] || matchInstance[0]; // Group 1 or full match
            const parsedDate = parseDate(dateStr); // Uses the simplified parseDate
            if (parsedDate) {
              return {
                date: parsedDate,
                confidence: pattern.confidence,
                context: matchInstance[0] 
              };
            }
          }
        }
        
        return null;
      }
      
      // Simplified date parser from your uploaded background.js
      function parseDate(dateStr) {
        if (!dateStr) return null;
        
        dateStr = dateStr.replace(/(\d+)(st|nd|rd|th)/g, '$1');

        // Handle seasonal dates
        const seasonMatch = dateStr.match(/(Spring|Summer|Fall|Autumn|Winter)\s+(\d{4})/i);
        if (seasonMatch) {
          const season = seasonMatch[1].toLowerCase();
          const year = seasonMatch[2];
          const seasonDates = {
            spring: `${year}-03-20`, summer: `${year}-06-21`,
            fall: `${year}-09-22`, autumn: `${year}-09-22`,
            winter: `${year}-12-21`
          };
          return seasonDates[season];
        }
        
        // Try to parse as regular date
        try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                // To avoid timezone shifts for date-only strings
                const year = date.getFullYear();
                const month = date.getMonth() + 1; // getMonth() is 0-indexed
                const day = date.getDate();
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        } catch (e) { /* Ignore parsing errors, try next pattern */ }
        
        return null;
      }
      
      // Listen for tab updates
      chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        if (changeInfo.status === 'complete' && tab.url) {
          // Updated to match manifest's content script URLs
          const youtubePattern1 = "https://www.youtube.com/*/";
          const youtubePattern2 = "https://m.youtube.com/*/";
          
          if (tab.url.startsWith(youtubePattern1) || tab.url.startsWith(youtubePattern2) ||
              tab.url.includes('imdb.com') || // Example other sites
              tab.url.includes('gamespot.com') ||
              tab.url.includes('ign.com')) {
            
            chrome.action.setBadgeText({ text: '!', tabId: tabId });
            chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: tabId });
          } else {
            chrome.action.setBadgeText({ text: '', tabId: tabId });
          }
        }
      });    
    
