/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */

const express = require("express");
const router = express.Router();
const countryCodes = require('country-codes-list');
const bcrypt = require('bcrypt');
const auth = require("../middleware/auth");
const AllFunction = require("../route_function/function");
const multer  = require('multer');
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");



// ============= Add Customer ================ //
const cusImage = `./public/uploads/customer`;
AllFunction.ImageUploadFolderCheck(cusImage);
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/customer");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);
    }
});

const customer = multer({storage : storage});

router.get("/add", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        
        res.render('add_customer', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/signup_ajex", auth, async(req, res)=>{
    try {
        const {country, phone, email} = req.body;

        let pcheck = 0, emailc = 0; 
        const login_phone = await DataFind(`SELECT * FROM tbl_customer WHERE country_code = '${country}' AND phone = '${phone}'`);
        if (login_phone != '') pcheck = 1;
        
        const emailcheck = await DataFind(`SELECT * FROM tbl_customer WHERE email = '${email}'`);
        if (emailcheck != '') emailc = 1;

        res.send({pcheck, emailc});
    } catch (error) {
        console.log(error);
        res.send({pcheck:2, emailc:2});
    }
});

router.post("/add_customer", auth, customer.single("image"), async(req, res)=>{
    try {
        const {Name, Email, country_code, phone, Password, status} = req.body;

        const hash = await bcrypt.hash(Password, 10);
        const sttauss = status == "on" ? 1 : 0;

        const imageUrl = req.file ? "uploads/customer/" + req.file.filename : null;

        if (await DataInsert(`tbl_customer`, `image, name, email, country_code, phone, password, tot_balance, tot_favorite, status, referral_code, pending_ref, date`, 
            `'${imageUrl}', '${Name}', '${Email}', '${country_code}', '${phone}', '${hash}', '0', '[]', '${sttauss}', '${new Date().toISOString().split('T')[0]}', 
            '', '${new Date().toISOString().split('T')[0]}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            res.redirect("/valid_license");
        }
        
        req.flash('success', 'Customer Add successfully');
        res.redirect("/customer/view");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

// ============= Customer ================ //

router.get('/view', auth, async(req, res)=>{
    try {
        const customer = await DataFind(`SELECT id, image, name, email, country_code, phone, status FROM tbl_customer`);

        res.render("list_customer", {
            auth:req.user, customer, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

// ============= Edit Customer ================ //

router.get("/edit/:id", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);

        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${req.params.id}'`);

        res.render('edit_customer', {
            auth:req.user, customer, nameCode, CountryCode, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_customer_ajax", auth, async(req, res)=>{
    try {
        const {nenail, sccode, sphone} = req.body;
        
        let pcheck = 0, emailc = 0; 
        if (sccode != '' || sphone != '') {
            const login_phone = await DataFind(`SELECT * FROM tbl_customer WHERE country_code = '${sccode}' AND phone = '${sphone}'`);
            if (login_phone != '') pcheck = 1;
        }
        
        if (nenail != '') {
            const emailcheck = await DataFind(`SELECT * FROM tbl_customer WHERE email = '${nenail}'`);
            if (emailcheck != '') emailc = 1;
        }
        
        res.send({pcheck, emailc});
    } catch (error) {
        console.log(error);
        res.send({pcheck:2, emailc:2});
    }
});

router.post("/edit_customer/:id", auth, customer.single("image"), async(req, res)=>{
    try {
        const {Name, Email, country_code, phone, Password, status} = req.body;

        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${req.params.id}'`);
        const status_no = status == "on" ? 1 : 0;
        
        let imageUrl = "";
        if (req.file) {
            await AllFunction.DeleteImage(customer[0].image);
            imageUrl = "uploads/customer/" + req.file.filename
        } else imageUrl = customer[0].image;

        const hash = Password != '' ? await bcrypt.hash(Password, 10) : customer[0].password;

        if (await DataUpdate(`tbl_customer`, `image = '${imageUrl}', name = '${Name}', email = '${Email}', country_code = '${country_code}', phone = '${phone}', password = '${hash}', 
            status = '${status_no}'`, `id = '${customer[0].id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Customer Updated successfully');
        res.redirect("/customer/view");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${req.params.id}'`);
        
        if (customer != '') {
            await AllFunction.DeleteImage(customer[0].image);
            if (await DataDelete(`tbl_customer`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
            
                req.flash('errors', process.env.dataerror);
                res.redirect("/valid_license");
            }
        }

        req.flash('success', 'Customer Delete successfully');
        res.redirect("/customer/view");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});





module.exports = router;