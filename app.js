require('dotenv').config();
const express = require('express')
const app = express()
const port = process.env.port || 3123
const bodyParser = require('body-parser')
const ejs = require('ejs')
const path = require("path")
const {connection} = require("./middleware/db");
const cookieParser = require('cookie-parser')
const flash = require("connect-flash");
const session = require("express-session");
const { SocketList } = require("./route_socket/socket")
const cors = require("cors");
const helmet = require("helmet");


app.set('trust proxy', true);

app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: {maxAge: 1000 * 60 }
}))

app.use((req, res, next) => {
  connection.query("SELECT data FROM tbl_validate", (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return next(err);
    }
    const scriptFile = results[0].data; // Get the script file data

    // Set the scriptFile variable in res.locals
    res.locals.scriptFile = scriptFile;
    next();
  });
}); 

app.use(flash());

app.set('view engine', 'ejs');
app.set("views", path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json({ limit: '100mb' }))
app.use(bodyParser.urlencoded({extended : false, limit: '100mb'}));
app.use(bodyParser.json());
app.use(cookieParser())
app.use(cors());

app.use(
    helmet({
        contentSecurityPolicy: false, // Disable CSP if not configured
        
        // noCache: true, // For older versions, now deprecated // // // Old Added
        referrerPolicy: {
            policy: "strict-origin-when-cross-origin", // or use "no-referrer-when-downgrade" // // // New
        }

    })
);

// Middleware to set no-cache headers explicitly
app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    next();
});


app.use(function (req, res, next) {
    res.locals.success = req.flash("success");
    res.locals.errors = req.flash("errors");
    next();
});




// ============= Mobile ================ //
app.use("/customer", require("./route_mobile/customer_api"))
app.use("/doctor", require("./route_mobile/doctor_api"))
app.use("/chat", require("./route_mobile/chat_api"))
app.use("/customer", require("./route_mobile/customer_product"))
app.use("/customer", require("./route_mobile/payment"))
app.use("/doctor", require("./route_mobile/lab"))

// ============= Web ================ //
app.use("/", require("./router/login"))
app.use("/", require("./router/index"))
app.use("/department", require("./router/department"))
app.use("/store_category", require("./router/store_category"))
app.use("/hospital", require("./router/hospital"))
app.use("/doctor", require("./router/admin_doctor"))

app.use("/category", require("./router/category"))

app.use("/services", require("./router/services"))
app.use("/customer", require("./router/customer"))
app.use("/settings", require("./router/settings"))
app.use("/zone", require("./router/zone"))
app.use("/user", require("./router/user_data"))
app.use("/booking", require("./router/doctor_order"))
app.use("/chat", require("./router/chat"))
app.use("/report", require("./router/report"))
app.use("/role", require("./router/role_permission"))
app.use("/user", require("./router/doctor_product_setting"))
app.use("/lab", require("./router/lab"))
app.use("/dynamic", require("./router/dynamic_section"))


const http = require('http');
const httpServer = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(httpServer);
SocketList(io);


httpServer.listen(port, ()=>{
    console.log(`Server running on port ${port}`);
})