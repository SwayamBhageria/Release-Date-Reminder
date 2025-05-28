document.addEventListener('DOMContentLoaded', function() {
    const extractBtn = document.getElementById('extractBtn');
    const createReminderBtn = document.getElementById('createReminderBtn');
    const authBtn = document.getElementById('authBtn');
    const loadingDiv = document.getElementById('loading');
    const statusDiv = document.getElementById('status');
    const extractedInfoDiv = document.getElementById('extracted-info');
    const authSectionDiv = document.getElementById('auth-section');
    const googleSearchBtn = document.getElementById('googleSearchBtn');

    function showLoading(show) {
        loadingDiv.style.display = show ? 'block' : 'none';
        extractBtn.disabled = show;
        if (show) {
            extractedInfoDiv.style.display = 'none';
            googleSearchBtn.style.display = 'none';
        }
    }

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
    }

    function hideStatus() {
        statusDiv.style.display = 'none';
    }

    function displayExtractedData(data) {
        window.currentPopupTitle = (data && data.title) ? data.title : document.title;
        window.extractedYearForSearch = null;
        if (data && data.releaseDate) {
            const yearMatch = data.releaseDate.match(/^\d{4}/);
            if (yearMatch) {
                window.extractedYearForSearch = yearMatch[0];
            }
        } else if (data && data.matchedContext && data.patternLabel && data.patternLabel.toLowerCase().includes("year")) {
            const yearMatchInContext = data.matchedContext.match(/\d{4}/);
            if (yearMatchInContext) {
                window.extractedYearForSearch = yearMatchInContext[0];
            }
        }

        if (data && data.releaseDate) {
            document.getElementById('title').textContent = data.title || 'N/A';
            document.getElementById('release-date').textContent = data.releaseDate;
            document.getElementById('custom-date').value = data.releaseDate;

            extractedInfoDiv.style.display = 'block';
            showStatus('Release date found!', 'success');

            if (data.confidence < 0.65) {
                googleSearchBtn.style.display = 'block';
            } else {
                googleSearchBtn.style.display = 'none';
            }
        } else {
            extractedInfoDiv.style.display = 'none';
            let message = 'No release date found on the page.';
            if (data && data.platform === 'youtube' && data.sourceText === '') {
                message += ' Could not find or access description text.';
            } else if (data && data.sourceText && data.sourceText.length > 0 && data.sourceText.length < 50) {
                 message += ' Not much text found to analyze.';
            }
            showStatus(message, 'info');
            googleSearchBtn.style.display = 'block';
        }
    }

    extractBtn.addEventListener('click', async function() {
        showLoading(true);
        hideStatus();
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || !tab.id) {
                showStatus('No active tab with ID found.', 'error');
                showLoading(false);
                return;
            }

            // Check if the URL is a restricted chrome://, edge://, or about: URL
            if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:'))) {
                showStatus('Cannot extract from this type of page.', 'error');
                googleSearchBtn.style.display = 'block'; // Still allow Google search
                showLoading(false);
                return;
            }

            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
            } catch (injectionError) {
                console.warn("Failed to inject content.js (might be already injected or on a restricted page):", injectionError.message);
                // Potentially show a more specific error to the user here if injection fails for other reasons
                // For now, we'll let the executeScript for the function call handle further errors.
            }

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => window.extractReleaseDateFromPage()
            });
            
            if (results && results[0] && results[0].result) {
                const extractedData = results[0].result;
                displayExtractedData(extractedData);
            } else if (chrome.runtime.lastError) {
                console.error("Error executing script in popup.js:", chrome.runtime.lastError.message);
                showStatus('Error extracting data: ' + chrome.runtime.lastError.message, 'error');
                 googleSearchBtn.style.display = 'block'; // Show search button on error
            } else {
                displayExtractedData(null);
            }
        } catch (error) {
            console.error("Error during extraction process in popup.js:", error);
            showStatus('Error extracting data: ' + error.message, 'error');
            googleSearchBtn.style.display = 'block'; // Show search button on error
        }
        
        showLoading(false);
    });

    createReminderBtn.addEventListener('click', async function() {
      const customDateValue = document.getElementById('custom-date').value;
      const titleText = document.getElementById('title').textContent;
      const releaseDate = customDateValue;
      
      if (!releaseDate) {
        showStatus('Please ensure a valid date is present in the date input.', 'error');
        return;
      }
      if (!titleText || titleText === 'N/A') {
        showStatus('Cannot create reminder without a title.', 'error');
        return;
      }
      
      showLoading(true);
      try {
        await createCalendarEvent(titleText, releaseDate);
        showStatus('Calendar reminder created successfully!', 'success');
      } catch (error) {
        console.error("Calendar event creation error in popup.js:", error);
        if (error.message && (error.message.toLowerCase().includes('auth') ||
                              error.message.toLowerCase().includes('token') ||
                              error.message.toLowerCase().includes('oauth') ||
                              error.message.includes('401'))) {
          authSectionDiv.style.display = 'block';
          showStatus('Authorization required for Google Calendar. Please click Authorize.', 'info');
        } else {
          showStatus('Error creating reminder: ' + error.message, 'error');
        }
      }
      showLoading(false);
    });
  
    authBtn.addEventListener('click', async function() {
      showLoading(true);
      try {
        await authorizeGoogleCalendar();
        authSectionDiv.style.display = 'none';
        showStatus('Authorization successful! You can now try creating the reminder again.', 'success');
      } catch (error) {
        console.error("Google Calendar authorization error in popup.js:", error);
        showStatus('Authorization failed: ' + error.message, 'error');
      }
      showLoading(false);
    });

    googleSearchBtn.addEventListener('click', function() {
        let queryTitle = window.currentPopupTitle || "current page";
        const extractedYear = window.extractedYearForSearch || "";

        queryTitle = queryTitle
            .replace(/official trailer/gi, '')
            .replace(/trailer/gi, '')
            .replace(/teaser/gi, '')
            .replace(/official video/gi, '')
            .replace(/music video/gi, '')
            .replace(/lyric video/gi, '')
            .replace(/official song/gi, '')
            .replace(/song/gi, '')
            .replace(/full movie/gi, '')
            .replace(/movie clip/gi, '')
            .replace(/clip/gi, '')
            .replace(/\|\s*youtube/i, '')
            .replace(/-\s*youtube/i, '')
            .replace(/\[.*?\]/g, '')      
            .replace(/\(official.*?\)/gi, '') 
            .replace(/\(.*?version.*?\)/gi, '') 
            .replace(/\b(hd|4k|1080p|720p)\b/gi, '') 
            .replace(/[#@]/g, '') 
            .replace(/\s+/g, ' ') 
            .trim();

        const titleParts = queryTitle.split(/[-|–—:]/); 
        queryTitle = titleParts[0].trim(); 

        if (queryTitle.length > 60) { 
            queryTitle = queryTitle.substring(0, 60).trim();
            const lastSpace = queryTitle.lastIndexOf(' ');
            if (lastSpace > 0) {
                queryTitle = queryTitle.substring(0, lastSpace);
            }
        }
        
        const searchQuery = `${queryTitle} ${extractedYear} release date`.trim().replace(/\s+/g, ' '); 
        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        chrome.tabs.create({ url: googleSearchUrl });
    });

    async function authorizeGoogleCalendar() {
        return new Promise((resolve, reject) => {
          chrome.identity.getAuthToken({ interactive: true }, function(token) {
            if (chrome.runtime.lastError) {
              console.error("chrome.identity.getAuthToken error:", chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message || "Unknown authentication error. Check console for details."));
            } else if (!token) {
              reject(new Error("Authorization failed: No token received. The user may have denied access."));
            } else {
              resolve(token);
            }
          });
        });
    }
      
    async function createCalendarEvent(title, releaseDateForAPI) {
        let token;
        try {
          token = await authorizeGoogleCalendar();
        } catch (authError) {
            throw authError;
        }
        
        if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDateForAPI)) {
            console.error("Invalid date format for Calendar API in createCalendarEvent:", releaseDateForAPI);
            throw new Error('Invalid date format for calendar event. Expected<y_bin_46>-MM-DD.');
        }

        const event = {
          summary: `${title} - Release Reminder`,
          description: `This is a reminder for the release of: ${title}.\nOriginal date string from page: ${document.getElementById('release-date').textContent}`, 
          start: {
            date: releaseDateForAPI 
          },
          end: {
            date: releaseDateForAPI
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 24 * 60 },
              { method: 'popup', minutes: 9 * 60 }
            ]
          }
        };
    
        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(event)
        });
    
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: { message: "Unknown calendar API error or non-JSON response."}}));
          console.error("Google Calendar API Error Response (status " + response.status + "):", errorData);
          throw new Error(`Calendar API error: ${response.status} - ${errorData.error?.message || 'Failed to create event. Check console for details.'}`);
        }
    
        return await response.json();
    }
});
