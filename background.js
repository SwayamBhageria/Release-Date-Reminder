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
      // Open the popup programmatically
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
      // Handle calendar event creation
      handleCalendarEvent(request.eventData, sendResponse);
      return true;
    }
  });
  
  async function handleSelectionExtraction(selectedText, sendResponse) {
    try {
      // Use the same date extraction logic as content script
      const dateResult = findReleaseDateInText(selectedText);
      
      if (dateResult) {
        sendResponse({
          success: true,
          title: selectedText.substring(0, 100),
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
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  
  async function handleCalendarEvent(eventData, sendResponse) {
    try {
      // This could be expanded to handle calendar creation via different services
      // For now, we'll let the popup handle Google Calendar integration
      sendResponse({
        success: true,
        message: "Calendar event creation initiated"
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  
  // Helper function to find dates in text (same as content script)
  function findReleaseDateInText(text) {
    if (!text) return null;
    
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
    ];
  
    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const dateStr = match[1];
        const parsedDate = parseDate(dateStr);
        if (parsedDate) {
          return {
            date: parsedDate,
            confidence: pattern.confidence
          };
        }
      }
    }
    
    return null;
  }
  
  function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // Handle seasonal dates
    if (dateStr.match(/(Spring|Summer|Fall|Autumn|Winter)/i)) {
      const season = dateStr.match(/(Spring|Summer|Fall|Autumn|Winter)/i)[1].toLowerCase();
      const year = dateStr.match(/\d{4}/)[0];
      
      const seasonDates = {
        spring: `${year}-03-20`,
        summer: `${year}-06-21`,
        fall: `${year}-09-22`,
        autumn: `${year}-09-22`,
        winter: `${year}-12-21`
      };
      
      return seasonDates[season];
    }
    
    // Try to parse as regular date
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    return null;
  }
  
  // Listen for tab updates to potentially auto-detect release content
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
      // Could add auto-detection logic here for known movie/game sites
      if (tab.url.includes('youtube.com/watch') || 
          tab.url.includes('imdb.com') ||
          tab.url.includes('gamespot.com') ||
          tab.url.includes('ign.com')) {
        
        // Set a badge to indicate the extension can work on this page
        chrome.action.setBadgeText({
          text: '!',
          tabId: tabId
        });
        
        chrome.action.setBadgeBackgroundColor({
          color: '#4CAF50',
          tabId: tabId
        });
      } else {
        chrome.action.setBadgeText({
          text: '',
          tabId: tabId
        });
      }
    }
  });