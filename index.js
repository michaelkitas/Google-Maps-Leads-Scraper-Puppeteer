// Import the necessary libraries
const fs = require("fs"); // File system, for writing files
const proxyChain = require("proxy-chain"); // For anonymizing the proxy
const puppeteer = require("puppeteer-extra"); // Enhanced version of Puppeteer for additional functionality

// Import and use stealth plugin to prevent detection of the browser automation
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

// Define the proxy settings
const proxy = "http://username:password@proxy-host:proxy-port";

// The main async function where the browser automation takes place
const main = async () => {
  // Anonymize the proxy to prevent detection
  const newProxyUrl = await proxyChain.anonymizeProxy(proxy);
  console.log(newProxyUrl); // Print the new anonymized proxy URL

  // Launch the browser with specified options
  const browser = await puppeteer.launch({
    headless: false, // Run browser in headless mode (no UI)
    args: [`--proxy-server=${newProxyUrl}`], // Use the anonymized proxy
  });

  // Create a new page in the browser
  const page = await browser.newPage();
  const keyword = "lawyer"; // Define the search keyword
  // Navigate to Google Maps and search for the keyword
  await page.goto(`https://www.google.com/maps/search/${keyword}/`);

  // Try to find and click the accept cookies button, if it appears
  try {
    const acceptCookiesSelector = "form:nth-child(2)";
    await page.waitForSelector(acceptCookiesSelector, { timeout: 5000 });
    await page.click(acceptCookiesSelector);
  } catch (error) {
    // If the selector is not found or times out, catch the error and continue
  }

  // Scroll through the search results on Google Maps to load all items
  await page.evaluate(async () => {
    const searchResultsSelector = 'div[role="feed"]';
    const wrapper = document.querySelector(searchResultsSelector);

    await new Promise((resolve, reject) => {
      var totalHeight = 0;
      var distance = 1000; // How much to scroll each time
      var scrollDelay = 3000; // Wait time between scrolls

      var timer = setInterval(async () => {
        var scrollHeightBefore = wrapper.scrollHeight;
        wrapper.scrollBy(0, distance);
        totalHeight += distance;

        // If we've scrolled to the bottom, wait, then check if more content loaded
        if (totalHeight >= scrollHeightBefore) {
          totalHeight = 0;
          await new Promise((resolve) => setTimeout(resolve, scrollDelay));

          var scrollHeightAfter = wrapper.scrollHeight;

          // If no new content, stop scrolling and finish
          if (scrollHeightAfter > scrollHeightBefore) {
            return;
          } else {
            clearInterval(timer);
            resolve();
          }
        }
      }, 200); // Interval time between each scroll
    });
  });

  // Extract data from the loaded search results
  const results = await page.evaluate(() => {
    const items = Array.from(
      document.querySelectorAll('div[role="feed"] > div > div[jsaction]')
    );

    return items.map((item) => {
      let data = {};

      // Extract the title, link, and website from each search result, handling errors gracefully
      try {
        data.title = item.querySelector(".fontHeadlineSmall").textContent;
      } catch (error) {}

      try {
        data.link = item.querySelector("a").getAttribute("href");
      } catch (error) {}

      try {
        data.website = item
          .querySelector('[data-value="Website"]')
          .getAttribute("href");
      } catch (error) {}

      // Extract the rating and number of reviews
      try {
        const ratingText = item
          .querySelector('.fontBodyMedium > span[role="img"]')
          .getAttribute("aria-label")
          .split(" ")
          .map((x) => x.replace(",", "."))
          .map(parseFloat)
          .filter((x) => !isNaN(x));

        data.stars = ratingText[0];
        data.reviews = ratingText[1];
      } catch (error) {}

      // Extract phone numbers from the text, using regex to match formats
      try {
        const textContent = item.innerText;
        const phoneRegex =
          /((\+?\d{1,2}[ -]?)?(\(?\d{3}\)?[ -]?\d{3,4}[ -]?\d{4}|\(?\d{2,3}\)?[ -]?\d{2,3}[ -]?\d{2,3}[ -]?\d{2,3}))/g;

        const matches = [...textContent.matchAll(phoneRegex)];
        let phoneNumbers = matches
          .map((match) => match[0])
          .filter((phone) => (phone.match(/\d/g) || []).length >= 10);

        let phoneNumber = phoneNumbers.length > 0 ? phoneNumbers[0] : null;
        if (phoneNumber) {
          phoneNumber = phoneNumber.replace(/[ -]/g, "");
        }

        data.phone = phoneNumber;
      } catch (error) {}

      return data; // Return the extracted data for each item
    });
  });

  // Filter out results without titles and write them to a file
  const filteredResults = results.filter((result) => result.title);
  fs.writeFileSync("results.json", JSON.stringify(filteredResults, null, 2)); // Save the results to a JSON file

  console.log("Completed"); // Log completion message

  await browser.close(); // Close the browser
};

main(); // Execute the main function
