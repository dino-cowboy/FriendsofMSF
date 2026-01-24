import express from "express";
import bodyParser from "body-parser"
import fetch from "node-fetch"
import axios from "axios"
import nodemailer from "nodemailer";
import env from "dotenv";
//Import required node modules

env.config();
//Import environment variables

const app = express();
const port = process.env.SERVER_PORT;
// Express is referenced as app and port is set to 3000 for local hosting

const GOOGLE_API_KEY = process.env.API_KEY;
const FOLDER_ID = process.env.FOLDER_ID;
//Google drive API and folder ID for fetching MSF photos 

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
//Allows for server to read client side data and encodes it in JSON format

app.use(express.static("public"));
//Links the public folder to the server

app.post('/send-email', async (req, res) => {

    const { name, email, message } = req.body;
    const recaptchaResponse = req.body['g-recaptcha-response']; // Grabs the token from the form
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    // 1. Check if the captcha was even attempted
    if (!recaptchaResponse) {
        return res.status(400).send("Please complete the reCAPTCHA.");
    }

    try {
        // 2. Verify with Google's API
        const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaResponse}`;
        const response = await axios.post(verifyUrl);

        if (!response.data.success) {
            return res.status(400).send("reCAPTCHA verification failed. Are you a bot?");
        }

        // 3. If successful, continue with Nodemailer
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP,
            port: process.env.EMAIL_PORT,
            secure: true, 
            auth: {
                user: "friendsmsfutd@gmail.com",
                pass: process.env.GMAIL_PASS,
            },
        });
        
         transporter.verify(function (error, success) {
    if (error) {
      console.log(error);
    } else {
      console.log("Server is ready to take our messages");
    }
    });


        const info = await transporter.sendMail({
            from: email,
            to: 'friendsmsfutd@gmail.com',
            subject: `Message from ${name}`,
            text: `${message} | Sent from: ${email}`,
        });
        
        res.redirect('/?success=true');
        console.log("Message sent: %s", info.messageId);
    }
      catch (error) { 
        console.error("Server Error:", error);
        res.status(500).send("Something went wrong on our end.");
    }

});


app.get('/drive-image', async (req, res) => {
    try {
        const { id } = req.query;
        const driveUrl = `https://drive.google.com/uc?export=view&id=${id}`;
        
        const response = await axios.get(driveUrl, { 
            responseType: 'arraybuffer',
            headers: {
                // Some Google Drive URLs require a user-agent
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        // Creates a proxy route for our Google Drive images
        
        res.set('Content-Type', response.headers['content-type']);
        res.send(response.data);
        //Sends image data to our server

    } catch (error) {
        console.error("Proxy error:", error);
        res.status(500).send("Error loading image");
    }
    //Logs an error if one occurs with the proxy server
});

app.get("/", (req, res) =>{
    res.render("index.ejs");
});
//Loads home page

app.get("/Contact", (req, res) => {
    res.render("contactUs.ejs", {
        siteKey: process.env.RECAPTCHA_SITE_KEY
    });
});
//Loads Contact US page

app.get("/Photos", async (req, res) => {

    try {
        const query = `'${FOLDER_ID}' in parents and mimeType contains 'image/'`;
        const apiUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&fields=files(id,name)`;
        //Sets up google drive api call for file information

        const response = await fetch(apiUrl);
        const data = await response.json();
        // Turns data into JSON format

        if (!data.files) {
            console.error("No files found:", data);
            return res.render("photos.ejs", { images: [] });
        }
        //If there are no google drive files in the folder, return no data and load the photos page

        // Use proxy URLs instead of direct Drive links
        const images = data.files.map(file => ({
            name: file.name,
            url: `/drive-image?id=${file.id}`, // Proxy URL
            directUrl: `https://drive.google.com/uc?export=view&id=${file.id}` // For debugging
        }));

        res.render("photos.ejs", { images });
        //Loads the photo page
    
    } catch (error) {
        console.error("Error fetching images:", error);
        res.render("photos.ejs", { images: [] });
    }
    //If any errors occur, log it and load the photos page with no data

});

app.get("/Join", (req, res) =>{
    res.render("joinUs.ejs");
});
//Loads Join Us page

app.listen(port, () => {
    console.log(`Running on port ${port}`);
});
//Check if site is being hosted and log it