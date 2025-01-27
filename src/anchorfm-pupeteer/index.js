const env = require('../environment-variables');
const puppeteer = require('puppeteer');

function addUrlToDescription(youtubeVideoInfo) {
    return env.URL_IN_DESCRIPTION ? 
        youtubeVideoInfo.description + '\n' + youtubeVideoInfo.url 
        : youtubeVideoInfo.description;
}

async function postEpisode(youtubeVideoInfo) {
    let browser = undefined;
    try {
        console.log("Launching puppeteer");
        browser = await puppeteer.launch({ args: ['--no-sandbox'], headless: env.PUPETEER_HEADLESS });
        const page = await browser.newPage();
    
        const navigationPromise = page.waitForNavigation();
    
        await page.goto('https://anchor.fm/dashboard/episode/new');
    
        await page.setViewport({ width: 1600, height: 789 });
    
        await navigationPromise;
    
        console.log("Trying to log in");
        await page.type('#email', env.ANCHOR_EMAIL);
        await page.type('#password', env.ANCHOR_PASSWORD);
        await page.click('button[type=submit]');
        await navigationPromise;
        console.log("Logged in");
    
        console.log("Uploading audio file");
        await page.waitForSelector('input[type=file]');
        const inputFile = await page.$('input[type=file]');
        await inputFile.uploadFile(env.AUDIO_FILE);
    
        console.log("Waiting for upload to finish");
        await page.waitForTimeout(25 * 1000);
    
        const saveEpisodeButtonSelector = '//span[contains(text(),"Save")]/parent::button[not(boolean(@disabled))]'
        await page.waitForXPath(saveEpisodeButtonSelector, { timeout: env.UPLOAD_TIMEOUT });
        const [saveButton] = await page.$x(saveEpisodeButtonSelector);
        await saveButton.click();
        await navigationPromise;
    
        console.log("-- Adding title");
        await page.waitForSelector('#title', { visible: true });
        // Wait some time so any field refresh doesn't mess up with our input
        await page.waitForTimeout(2000);
        await page.type('#title', youtubeVideoInfo.title);
    
        console.log("-- Adding description");
        await page.waitForSelector('div[role="textbox"]', { visible: true });
        const finalDescription = addUrlToDescription(youtubeVideoInfo);
        await page.type('div[role="textbox"]', finalDescription);
    
        console.log("-- Selecting content type");
        const selectorForExplicitContentLabel = env.IS_EXPLICIT ? 'label[for="podcastEpisodeIsExplicit-true"]' : 'label[for="podcastEpisodeIsExplicit-false"]'
        await page.waitForSelector(selectorForExplicitContentLabel, { visible: true});
        const contentTypeLabel = await page.$(selectorForExplicitContentLabel);
        await contentTypeLabel.click();
    
        if (env.LOAD_THUMBNAIL) {
            console.log("-- Uploading episode art");
            await page.waitForSelector('input[type=file][accept="image/*"]');
            const inputEpisodeArt = await page.$('input[type=file][accept="image/*"]');
            await inputEpisodeArt.uploadFile(env.THUMBNAIL_FILE);
    
            console.log("-- Saving uploaded episode art");
            const saveThumbnailButtonSelector = '//span[text()="Save"]/parent::button';
            await page.waitForXPath(saveThumbnailButtonSelector);
            const [saveEpisodeArtButton] = await page.$x(saveThumbnailButtonSelector);
            await saveEpisodeArtButton.click();
            await page.waitForXPath('//div[@aria-label="image uploader"]', { hidden: true, timeout: env.UPLOAD_TIMEOUT});
        }
    
        const saveDraftOrPublishButtonXPath = env.SAVE_AS_DRAFT ? '//button[text()="Save as draft"]' : '//span[text()="Publish now"]/parent::button'
        const saveDraftOrPublishLogMessage = env.SAVE_AS_DRAFT ? "Saving draft" : "Publishing";
        console.log(`-- ${saveDraftOrPublishLogMessage}`);
        
        const [button] = await page.$x(saveDraftOrPublishButtonXPath);
        await button.click();
        await navigationPromise;
    
        console.log("Yay");
    } catch (err) {
        throw new Error(`Unable to post episode to anchorfm: ${err}`);
    } finally {
        if(browser !== undefined) {
            await browser.close();
        }
    }
}

module.exports = {
    postEpisode
};
