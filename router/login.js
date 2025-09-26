/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const countryCodes = require('country-codes-list');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const AllFunction = require("../route_function/function");
const { DataFind, DataInsert } = require("../middleware/database_query");



router.get("/", async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        const login_data = await DataFind(`SELECT * FROM tbl_admin`);
        const general = await DataFind(`SELECT * FROM tbl_general_settings`);
        
        if (login_data == "") {
            const hash = await bcrypt.hash('123', 10);
            if (await DataInsert(`tbl_admin`, `name, email, country_code, phone, password, role`, `'admin', 'admin@admin.com', '+91', '9999999999', '${hash}', '1'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }

        res.render("login", {
            nameCode, CountryCode, general:general[0]
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
    }
});

router.post("/login", async(req, res)=>{
    try {
        const {udetail, password} = req.body;
        
        let status = 1, admin_role = 1, login_data = [], upass = '', rec = '', searchf = '', recep = [];

        let echeck = AllFunction.ChecValidEmail(udetail);
        if (echeck == true) searchf = `email = '${udetail}'`;
        else searchf = `phone = '${udetail}'`;

        login_data = await DataFind(`SELECT * FROM tbl_admin WHERE ${searchf}`);

        if (login_data == '') {
            login_data = await DataFind(`SELECT id, email, password, status FROM tbl_role_permission WHERE ${searchf}`);
            
            if (login_data != '') upass = login_data[0].password;
            status = 1; admin_role = 2;
        } else upass = login_data[0].password;

        if (login_data == '') {
            const general = await DataFind(`SELECT lab_active_status FROM tbl_general_settings`);
            if (general) {
                if (general[0].lab_active_status == 1) {
                    login_data = await DataFind(`SELECT * FROM tbl_lab_list WHERE ${searchf}`);

                    if (login_data != '') upass = login_data[0].password;
                    status = 1; admin_role = 4;
                }
            }
        } else upass = login_data[0].password;

        if (login_data == '') {
            if (echeck == false) recep = await DataFind(`SELECT * FROM tbl_doctor_receptionist WHERE ${searchf}`);
            
            if (recep.length > 0) {
                rec = `id = '${recep[0].doctor_id}'`;
                upass = recep[0].password;
            } else rec = `${searchf}`;

            login_data = await DataFind(`SELECT * FROM tbl_doctor_list WHERE ${rec}`), recep_status = rec.startsWith("id") == true ? 1 : 0;
            
            if (login_data != '') upass = login_data[0].password;
            status = 1; admin_role = 3;

        } else upass = login_data[0].password;

        // console.log(login_data);
        
        if (login_data == "") {
            req.flash('errors', echeck == true ? 'Email Not Register.' : ( isNaN(udetail) == false ? 'Phone No. Not Register' : 'Invalid Login Credentials!'  ) );
            return res.redirect("/");
        } else {
            if (login_data[0].status != 1 && admin_role != 1) {
                req.flash('errors', 'Account Deactivated!');
                return res.redirect("/");
            }
        }

        const hash_pass = await bcrypt.compare(password, upass);
        if (!hash_pass) {
            req.flash('errors', 'Your Password is Wrong');
            return res.redirect("/");
        }
            
        console.log(111111);

        const lan = req.cookies.dapplan;
        if (lan === undefined) {
            const lantoken = jwt.sign({lang:"en"}, process.env.jwt_key);
            res.cookie("dapplan", lantoken);
        }

        const token = jwt.sign({admin_id:login_data[0].id, admin_email:login_data[0].email, admin_role:admin_role, role_user:admin_role}, process.env.jwt_key);
        
        // res.cookie('dapp', token, {expires: new Date(Date.now() + 60000 * 60)});
        res.cookie('dapp', token);
        
        req.flash('success', 'login successfully');

        return res.redirect("/index");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/language", async(req, res)=>{
    try {
        const {lan} = req.body;
        const lantoken = jwt.sign({lang:lan}, process.env.jwt_key);
        res.cookie("dapplan", lantoken);

        res.status(200).json(lantoken);
    } catch (error) {
        console.log(error);
    }
});



router.get("/logout", async(req, res)=>{
    try {
        res.clearCookie("dapp");
        
        res.redirect("/");
    } catch (error) {
        console.log(error);
    }
});



module.exports = router;