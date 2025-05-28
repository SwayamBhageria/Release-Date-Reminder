
# 📅 Release  Reminder - Chrome Extension

Release Reminder is a browser extension for Google Chrome that helps you quickly extract release dates for movies, games, software, and more directly from web pages. Once a date is found, you can easily create a Google Calendar event to ensure you don't miss it !
Visit the [site](https://release-date-reminder-website.vercel.app/) for more details 
## Features

  * **Smart Date Extraction:** Automatically finds release dates mentioned in text on web pages, with a focus on YouTube video descriptions.
  * **Context Menu Integration:** Select any text on a page, right-click, and extract a release date.
  * **Automatic Description Expansion (YouTube):** Attempts to automatically expand collapsed YouTube video descriptions to access the full text for more accurate date extraction.
  * **Google Calendar Integration:**
      * One-click creation of Google Calendar events for extracted release dates.
      * Requires user authorization via Google OAuth 2.0.
  * **User-Friendly Interface:** Simple popup UI to view extracted information and manage calendar event creation.
  * **Date Adjustment:** Allows manual adjustment of the extracted date before creating a calendar event.

## Installation

### From Chrome Web Store (Recommended for most users)

1.  Visit the [Release Date Reminder page on the Chrome Web Store](CHROME_WEB_STORE_LINK_HERE) (Link will be active once published).
2.  Click "Add to Chrome".

### Manual Installation / For Development

1.  **Download or Clone the Repository:**
    ```bash
    git clone YOUR_GITHUB_REPOSITORY_LINK_HERE
    cd your-extension-folder-name
    ```
    Alternatively, download the ZIP of this repository and extract it.
2.  **Open Chrome Extensions Page:**
    Navigate to `chrome://extensions` in your Chrome browser.
3.  **Enable Developer Mode:**
    Turn on the "Developer mode" toggle, usually found in the top-right corner.
4.  **Load Unpacked Extension:**
    Click on the "Load unpacked" button.
    Select the directory where you cloned or extracted the extension's files (the folder containing `manifest.json`).
5.  The extension should now be installed and visible in your Chrome toolbar.

## How to Use

1.  **Automatic Extraction (e.g., on YouTube):**
      * Navigate to a webpage (like a YouTube video page) that mentions a release date.
      * Click the Release Date Reminder extension icon in your Chrome toolbar.
      * Click "🔍 Extract Release Date". The extension will attempt to find the date.
2.  **Context Menu Extraction:**
      * Select any text on a webpage that contains a release date.
      * Right-click on the selected text.
      * Choose "Extract Release Date" from the context menu.
      * The extension popup will open, attempting to show the extracted date from your selection.
3.  **Creating a Calendar Reminder:**
      * Once a date is extracted and shown in the popup, you can adjust it if necessary using the date input field.
      * Click "📅 Create Calendar Reminder".
      * If you haven't authorized the extension before, you'll be prompted to sign in with your Google account and grant permission for calendar access. (Ensure your account is added as a test user if the app is in "Testing" mode on Google Cloud Console).
      * A confirmation or error message will be displayed.

## Development & Setup

This extension is built using HTML, CSS, and JavaScript.

### Prerequisites

  * Google Chrome
  * A text editor (e.g., VS Code)
  * Git (for version control)

### OAuth 2.0 Setup (for Google Calendar Integration)

To enable the "Create Calendar Reminder" feature during development, you need to set up OAuth 2.0 credentials:

1.  **Create a Project on Google Cloud Console:** If you haven't already, create a project at [console.cloud.google.com](https://console.cloud.google.com/).
2.  **Enable Google Calendar API:** In your GCP project, go to "APIs & Services" \> "Library" and enable the "Google Calendar API".
3.  **Configure OAuth Consent Screen:**
      * Go to "APIs & Services" \> "OAuth consent screen".
      * Choose "External" user type.
      * Fill in the required app information.
      * Add the scope: `https://www.googleapis.com/auth/calendar.events`.
      * For development, keep it in "Testing" mode and add your Google account(s) as "Test users".
4.  **Create OAuth 2.0 Client ID:**
      * Go to "APIs & Services" \> "Credentials".
      * Click "+ CREATE CREDENTIALS" \> "OAuth client ID".
      * Select "Chrome App" as the application type.
      * Enter the **Application ID** of your locally loaded extension (you can find this on your `chrome://extensions` page).
      * Copy the generated **Client ID**.
5.  **Update `manifest.json`:**
      * Open the `manifest.json` file in the extension's source code.
      * Add or update the `oauth2` section with your Client ID:
        ```json
        "oauth2": {
          "client_id": "YOUR_COPIED_CLIENT_ID_HERE",
          "scopes": [
            "[https://www.googleapis.com/auth/calendar.events](https://www.googleapis.com/auth/calendar.events)"
          ]
        }
        ```
6.  Reload the extension in `chrome://extensions`.

## Contributing

Contributions are welcome\! If you have ideas for new features, improvements, or bug fixes, please feel free to:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/YourFeature` or `bugfix/YourBugfix`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some feature'`).
5.  Push to the branch (`git push origin feature/YourFeature`).
6.  Open a Pull Request.

Please make sure to test your changes thoroughly.

## Privacy

The privacy of our users is important. Please refer to our [Privacy Policy](https://release-date-reminder-website.vercel.app/privacy.html) for details on how data is handled by this extension.
