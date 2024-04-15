// written by cool-dev-guy
const puppeteer = require('puppeteer-extra');
const chrome = require('@sparticuz/chromium');

// Stealth plugin issue - There is a good fix but currently this works.
require('puppeteer-extra-plugin-user-data-dir')
require('puppeteer-extra-plugin-user-preferences')
require('puppeteer-extra-plugin-stealth/evasions/chrome.app')
require('puppeteer-extra-plugin-stealth/evasions/chrome.csi')
require('puppeteer-extra-plugin-stealth/evasions/chrome.loadTimes')
require('puppeteer-extra-plugin-stealth/evasions/chrome.runtime')
require('puppeteer-extra-plugin-stealth/evasions/defaultArgs') // pkg warned me this one was missing
require('puppeteer-extra-plugin-stealth/evasions/iframe.contentWindow')
require('puppeteer-extra-plugin-stealth/evasions/media.codecs')
require('puppeteer-extra-plugin-stealth/evasions/navigator.hardwareConcurrency')
require('puppeteer-extra-plugin-stealth/evasions/navigator.languages')
require('puppeteer-extra-plugin-stealth/evasions/navigator.permissions')
require('puppeteer-extra-plugin-stealth/evasions/navigator.plugins')
require('puppeteer-extra-plugin-stealth/evasions/navigator.vendor')
require('puppeteer-extra-plugin-stealth/evasions/navigator.webdriver')
require('puppeteer-extra-plugin-stealth/evasions/sourceurl')
require('puppeteer-extra-plugin-stealth/evasions/user-agent-override')
require('puppeteer-extra-plugin-stealth/evasions/webgl.vendor')
require('puppeteer-extra-plugin-stealth/evasions/window.outerdimensions')

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

export default async (req: any, res: any) => {
  let {body,method} = req

  // Some header shits
  if (method !== 'POST') {
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    )
    return res.status(200).end()
  }

  // Some checks...
  if (!body) return res.status(400).end(`No body provided`)
  if (typeof body === 'object' && !body.id) return res.status(400).end(`No url provided`)
  
  const id = body.id;
  const isProd = process.env.NODE_ENV === 'production'

  // create browser based on ENV
  let browser;
  if (isProd) {
    browser = await puppeteer.launch({
      args: chrome.args,
      defaultViewport: chrome.defaultViewport,
      executablePath: await chrome.executablePath(),
      headless: true,
      ignoreHTTPSErrors: true
    })
  } else {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    })
  }
  const page = await browser.newPage();
  await page.setRequestInterception(true);

  // Set headers,else wont work.
  await page.setExtraHTTPHeaders({ 'Referer': 'https://flixhq.to/' });

  // ======================================== Old ======================================================
  
    // const logger:string[] = [];
    // const finalResponse:{sources:string[],subtitles:string[]} = {sources:[],subtitles:[]}
    
    // page.on('request', async (interceptedRequest) => {
    //   console.log("[LOG]", interceptedRequest.url());
    //   await (async () => {
    //     logger.push(interceptedRequest.url());
    //     if (interceptedRequest.url().includes('.m3u8')) {
    //       const sourceArray:any = { quality: "auto", url: interceptedRequest.url() };
    //       finalResponse.sources.push(sourceArray);
    //     };
    //     if (interceptedRequest.url().includes('.vtt')) {
    //       const subtitleArray:any = { lang: interceptedRequest.url().split('/').pop().replace(".vtt", ""), url: interceptedRequest.url() };
    //       finalResponse.subtitles.push(subtitleArray);
    //     };
    //     interceptedRequest.continue();
    //   })();
    // });

  // ===================================================================================================

  // ======================================== New ======================================================

  interface ISubtile {
    file: string,
    label: string,
    kind: string,
    default?: boolean,
  }

  const logger: string[] = [];
  const finalResponse: { sources: string[], subtitles: ISubtile[] } = { sources: [], subtitles: [] }
  let urlSub;
  page.on('request', async (interceptedRequest) => {
    await (async () => {
      logger.push(interceptedRequest.url());
      // if (interceptedRequest.url().includes('.m3u8')) finalResponse.source = interceptedRequest.url();
      if (interceptedRequest.url().includes('.m3u8')) {
        const sourceArray:any = { quality: "auto", url: interceptedRequest.url() };
        finalResponse.sources.push(sourceArray);
      };
      //if (interceptedRequest.url().includes('getSource')) finalResponse.subtitle.push(interceptedRequest.url());
      interceptedRequest.continue();
    })();
  });

  page.on('response', async (interceptedResponse) => {
    if (interceptedResponse.url().includes('getSources')) {
      urlSub = interceptedResponse.url();
      // console.log(urlSub)
      const text = await interceptedResponse.json();
      const sources = JSON.parse(JSON.stringify(text));
      // console.log(sources.tracks);
      finalResponse.subtitles.push(sources.tracks);

    }
  });

  // ===================================================================================================
  
  try {
    const [req] = await Promise.all([
      page.waitForRequest(req => req.url().includes('.m3u8'), { timeout: 20000 }),
      page.goto(`https://rabbitstream.net/v2/embed-4/${id}?z=&_debug=true`, { waitUntil: 'domcontentloaded' }),
    ]);
  } catch (error) {
    return res.status(500).end(`Server Error,check the params.`)
  }
  await browser.close();

  // Response headers.
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate')
  res.setHeader('Content-Type', 'application/json')
  // CORS
  // res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )
  console.log(finalResponse);
  res.json(finalResponse);
};
