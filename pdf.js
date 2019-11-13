"use strict";
const chromium = require("chrome-aws-lambda");
var AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");

AWS.config.update({ region: "us-east-1" });
const s3 = new AWS.S3();

module.exports.pdf = async (event, context, callBack) => {

  const data = {
    title: " Pdf generation using puppeteer",
    text: " Handlebar is awesome!"
  }
  const executablePath = event.isOffline
    ? "./node_modules/puppeteer/.local-chromium/mac-674921/chrome-mac/Chromium.app/Contents/MacOS/Chromium"
    : await chromium.executablePath;
  const file = fs.readFileSync(path.resolve(__dirname, "template.hbs"), 'utf8')
  const template = handlebars.compile(file)
  const html = template(data)

  let browser = null;

  try {
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless
    });

    const page = await browser.newPage();

    page.setContent(html);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" }
    });

    // TODO: Response with PDF (or error if something went wrong )
    const response = {
      headers: {
        "Content-type": "application/pdf",
        "content-disposition": "attachment; filename=test.pdf"
      },
      statusCode: 200,
      body: pdf.toString("base64"),
      isBase64Encoded: true
    };

    const output_filename = 'pdf-demo.pdf';

    const s3Params = {
      Bucket: "pdf-demo-pipesort",
      Key: `public/pdfs/${output_filename}`,
      Body: pdf,
      ContentType: "application/pdf",
      ServerSideEncryption: "AES256"
    };

    s3.putObject(s3Params, err => {
      if (err) {
        console.log("err", err);
        return callBack(null, { error });
      }
    });

    context.succeed(response);

  } catch (error) {
    return context.fail(error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
};