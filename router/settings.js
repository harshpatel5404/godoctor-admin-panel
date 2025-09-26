/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const countryCodes = require('country-codes-list');
const multer  = require('multer');
const auth = require("../middleware/auth");
let mysql = require('mysql');
const bcrypt = require('bcrypt');
const AllFunction = require("../route_function/function");
const sendOneNotification = require("../middleware/send");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");

AllFunction.ImageUploadFolderCheck(`./public/uploads/settings`);
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/settings");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const upload = multer({storage : storage});

AllFunction.ImageUploadFolderCheck(`./public/uploads/banner`);
const storage1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/banner");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const banner = multer({storage : storage1});

AllFunction.ImageUploadFolderCheck(`./public/uploads/payment_image`);
const storage2 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/payment_image");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const payment = multer({storage : storage2});

AllFunction.ImageUploadFolderCheck(`./public/uploads/send_notification`);
const storage4 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/send_notification");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const notification = multer({storage : storage4});

// ============= General Setting ================ //

router.get("/general", auth, async(req, res)=>{
    try {
        let general_setting = await DataFind(`SELECT * FROM tbl_general_settings`);
        
        if (general_setting == "") {
            if (await DataInsert(`tbl_general_settings`,
                
                `dark_image, light_image, title, site_currency, currency_placement, thousands_separator, google_map_key, commission_rate, commisiion_type, signup_credit, refer_credit, 
                d_min_withdraw, one_app_id, one_api_key, sms_type, msg_key, msg_token, twilio_sid, twilio_token, twilio_phoneno, tot_book_appo_date, agora_app_id, 
                doctor_auto_approve, lab_min_withdraw, lab_active_status, lab_auto_approve, one_app_id_react, one_api_key_react, footer_content`,
                                
                `'null', 'null', 'Pet', '$', '0', '1', '0', '0', 'fix', '0', '0', '0', '', '', '1', '', '', '', '', '', '0', '', '0', '0', '0', '0', '', '', ''`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            general_setting = await DataFind(`SELECT * FROM tbl_general_settings`);
        }

        res.render("general_setting", {
            auth:req.user, general:general_setting[0], noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_setting", auth, upload.fields([{name: 'dark_image', maxCount: 1}, {name: 'light_image', maxCount: 1}]), async(req, res)=>{
    try {
        const {title, site_currency, currency_status, thousands_separator, google_map_key, commission_rate, commisiion_type, signup_credit, refer_credit, d_min_withdraw, one_app_id, 
                one_api_key, smstype, msgkey, msgid, twisid, twitoken, twipnumber, tot_book_appo_date, agora_app_id, doctor_auto_approve, lab_min_withdraw, lab_auto_approve, 
                lab_active_status, one_app_id_react, one_api_key_react, web_pay_success_url, footer_content} = req.body;
        const general_setting = await DataFind(`SELECT * FROM tbl_general_settings`);

        const dark_img = req.files.dark_image ? "uploads/settings/" + req.files.dark_image[0].filename : general_setting[0].dark_image;
        const light_img = req.files.light_image ? "uploads/settings/" + req.files.light_image[0].filename : general_setting[0].light_image;
        
        let currency_placement = currency_status == "on" ? 1 : 0;
        let ctype = commisiion_type == "on" ? '%' : 'fix';

        if (general_setting == "") {

            if (await DataInsert(`tbl_general_settings`,
                `dark_image, light_image, title, site_currency, currency_placement, thousands_separator, google_map_key, commission_rate, commisiion_type, signup_credit, refer_credit, 
                d_min_withdraw, one_app_id, one_api_key, sms_type, msg_key, msg_token, twilio_sid, twilio_token, twilio_phoneno, tot_book_appo_date, agora_app_id, doctor_auto_approve, 
                lab_min_withdraw, lab_active_status, lab_auto_approve, one_app_id_react, one_api_key_react, web_pay_success_url, footer_content`,
                `'${dark_img}', '${light_img}', '${title}', '${site_currency}', '${currency_placement}', '${thousands_separator}', '${google_map_key}', '${commission_rate}', '${ctype}', 
                '${signup_credit}', '${refer_credit}', '${d_min_withdraw}', '${one_app_id}', '${one_api_key}', '${smstype}', '${msgkey}', '${msgid}', '${twisid}', '${twitoken}', 
                '${twipnumber}', '${tot_book_appo_date}', '${agora_app_id}', '${doctor_auto_approve == "on" ? 1 : 0}', '${lab_min_withdraw}', '${lab_active_status == "on" ? 1 : 0}', 
                '${lab_auto_approve == "on" ? 1 : 0}', '${one_app_id_react}', '${one_api_key_react}', '${web_pay_success_url}', '${footer_content}'`,
                req.hostname, req.protocol
            ) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

        } else {
            
            if (await DataUpdate(`tbl_general_settings`,
                `dark_image = '${dark_img}', light_image = '${light_img}', title = '${title}', site_currency = '${site_currency}', currency_placement = '${currency_placement}', 
                thousands_separator = '${thousands_separator}', google_map_key = '${google_map_key}', commission_rate = '${commission_rate}', commisiion_type = '${ctype}', 
                signup_credit = '${signup_credit}', refer_credit = '${refer_credit}', d_min_withdraw = '${d_min_withdraw}', one_app_id = '${one_app_id}', one_api_key = '${one_api_key}', 
                sms_type = '${smstype}', msg_key = '${msgkey}', msg_token = '${msgid}', twilio_sid = '${twisid}', twilio_token = '${twitoken}', twilio_phoneno = '${twipnumber}', 
                tot_book_appo_date = '${tot_book_appo_date}', agora_app_id = '${agora_app_id}', doctor_auto_approve = '${doctor_auto_approve == "on" ? 1 : 0}',
                lab_min_withdraw = '${lab_min_withdraw}', lab_active_status = '${lab_active_status == "on" ? 1 : 0}', lab_auto_approve = '${lab_auto_approve == "on" ? 1 : 0}', 
                one_app_id_react = '${one_app_id_react}', one_api_key_react = '${one_api_key_react}', web_pay_success_url = '${web_pay_success_url}', 
                footer_content = '${footer_content}'`,
                `id = '${general_setting[0].id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }

        req.flash('success', 'Setting Updated successfully');
        res.redirect("/settings/general");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Edit Profile ================ //

router.get("/profile", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);

        console.log(req.user.role_user);
        
        let admin_data = [];

        if (req.user.admin_role == 1) {

            if (req.user.admin_role == 1) admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${req.user.admin_id}'`);
            console.log(req.user.admin_id);
            
            if (req.user.role_user == 2) admin_data = await DataFind(`SELECT id, name, email, country_code, phone FROM tbl_role_permission WHERE id = '${req.user.admin_id}'`);
            console.log(admin_data);
            
        } else if (req.user.admin_role == 3) {

            admin_data = await DataFind(`SELECT id, logo, cover_logo, name, email, country_code, phone, title, subtitle, year_of_experience, description, cancel_policy FROM tbl_doctor_list WHERE id = '${req.user.admin_id}'`);

        } else if (req.user.admin_role == 4) {

            admin_data = await DataFind(`SELECT * FROM tbl_lab_list WHERE id = '${req.user.admin_id}'`);
        }

        if (admin_data.length == 0) {
            req.flash('errors', `User not found`);
            return res.redirect("back");
        }
        
        res.render("edit_profile", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode, admin_data:admin_data[0]
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/admin_detail_update", auth, async(req, res)=>{
    try {
        const {name, email, country_code, phone, password} = req.body;
        
        console.log(req.user.admin_role);
        console.log(req.user.role_user);
        
        let check_email = true, check_mobileno = true, me_message = [], admd = [];
        if (req.user.admin_role == 1) admd =  await DataFind(`SELECT * FROM tbl_admin WHERE id = '${req.user.admin_id}'`);
        if (req.user.role_user == 2) admd =  await DataFind(`SELECT * FROM tbl_role_permission WHERE id = '${req.user.admin_id}'`);
        
        if (email != admd[0].email) {
            const emailExists = await DataFind(`SELECT email FROM tbl_doctor_list WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_lab_list WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_role_permission WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_admin WHERE email = '${email}'`);

            if (emailExists != '') {
                me_message.push("Email");
                check_email = false;
            } else  check_email = true;
        }

        if (country_code != admd[0].country_code || phone != admd[0].phone) {
            const phoneExists = await DataFind(`SELECT phone FROM tbl_doctor_list WHERE country_code = '${country_code}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_lab_list WHERE country_code = '${country_code}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_role_permission WHERE country_code = '${country_code}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_admin WHERE country_code = '${country_code}' AND phone = '${phone}'`);

            if (phoneExists != '') {
                me_message.push("Mobile Number");
                check_mobileno = false;
            } else  check_mobileno = true;
        }

        if (check_email == false || check_mobileno == false) return res.send({ status: false, message: me_message.length > 0 ? `${me_message.join(" and ")} already exist!` : '' , check_email, check_mobileno });

        let hash = password != '' ? bcrypt.hash(password, 10) : admd[0].password;

        if (req.user.admin_role == 1) {
            if (await DataUpdate(`tbl_admin`, `name = '${name}', email = '${email}', country_code = '${country_code}', phone = '${phone}', password = '${hash}'`, 
                `id = '${admd[0].id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
        } 
        
        if (req.user.role_user == 2) {
            
            if (await DataUpdate(`tbl_role_permission`, `name = '${name}', email = '${email}', country_code = '${country_code}', phone = '${phone}', password = '${hash}'`, 
                `id = '${admd[0].id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }

        res.send({status: true, message: 'Profile Update Successfully'});
    } catch (error) {
        console.log(error);
        res.send({status: false, message: 'Inernal Server Error!'});
    }
});

const storage7 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/doctor");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const doctor = multer({storage : storage7});

router.post("/doctor_detail_update", auth, doctor.fields([{name: 'logo', maxCount: 1}, {name: 'cover_logo', maxCount: 1}]), async(req, res)=>{
    try {
        const {name, email, password, year_of_experience, title, subtitle, description, cancel_policy} = req.body;
        
        let check_email = true, logo = '', cover_logo = '';

        const admd = await DataFind(`SELECT * FROM tbl_doctor_list WHERE id = '${req.user.admin_id}'`);
        
        if (admd.length == 0) {
            if (req.files) {
                if (req.files.logo) await AllFunction.DeleteImage("uploads/doctor/" + req.files.logo[0].filename);
                if (req.files.cover_logo) await AllFunction.DeleteImage("uploads/doctor/" + req.files.cover_logo[0].filename);
            }

            return res.send({ status: false, message: 'User Not Found!', check_email });
        }

        if (email != admd[0].email) {
            const emailExists = await DataFind(`SELECT email FROM tbl_doctor_list WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_lab_list WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_role_permission WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_admin WHERE email = '${email}'`);

            if (emailExists != '') {
                check_email = false;
                if (req.files) {
                    if (req.files.logo) await AllFunction.DeleteImage("uploads/doctor/" + req.files.logo[0].filename);
                    if (req.files.cover_logo) await AllFunction.DeleteImage("uploads/doctor/" + req.files.cover_logo[0].filename);
                }
                return res.send({ status: false, message: me_message.length > 0 ? `Email already exist!` : '' , check_email });
            } else  check_email = true;
        }

        if (req.files) {
            if (req.files.logo) {
                await AllFunction.DeleteImage(admd[0].logo);
                logo = "uploads/doctor/" + req.files.logo[0].filename;
            } else logo = admd[0].logo;

            if (req.files.cover_logo) {
                await AllFunction.DeleteImage(admd[0].cover_logo);
                cover_logo = "uploads/doctor/" + req.files.cover_logo[0].filename;
            } else cover_logo = admd[0].cover_logo;
        }

        const hash = password != '' ? await bcrypt.hash(password, 10) : admd[0].password, sit_title = mysql.escape(title), sit_subtitle = mysql.escape(subtitle), 
                                sit_destitle = mysql.escape(description), sit_cantitle = mysql.escape(cancel_policy)

        if (await DataUpdate(`tbl_doctor_list`, `logo = '${logo}', cover_logo = '${cover_logo}', name = '${name}', email = '${email}', password = '${hash}', title = ${sit_title}, 
            subtitle = ${sit_subtitle}, year_of_experience = '${year_of_experience}', description = ${sit_destitle}, cancel_policy = ${sit_cantitle}`, 
            `id = '${admd[0].id}'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        res.send({status: true, message: 'Profile Update Successfully'});
    } catch (error) {
        console.log(error);
        res.send({status: false, message: 'Internal Server Error!'});
    }
});



const storage8 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/lab");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const lab = multer({storage : storage8});

router.post("/lab_detail_update", auth, lab.single('logo'), async(req, res)=>{
    let logo = req.file ? "uploads/lab/" + req.file.filename : null;
    try {
        const {name, email} = req.body;
        
        const admd = await DataFind(`SELECT * FROM tbl_lab_list WHERE id = '${req.user.admin_id}'`);
        if (admd.length == 0) {
            if (req.file && logo != null) await AllFunction.DeleteImage(logo);
            return res.send({ status: false, message: 'User Not Found!', check_email });
        }

        if (email != admd[0].email) {
            const emailExists = await DataFind(`SELECT email FROM tbl_doctor_list WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_lab_list WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_role_permission WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_admin WHERE email = '${email}'`);

            if (emailExists != '') {
                check_email = false;
                if (req.file && logo != null) await AllFunction.DeleteImage(logo);
                return res.send({ status: false, message: me_message.length > 0 ? `Email already exist!` : '' , check_email });
            } else  check_email = true;
        }

        if (req.file) await AllFunction.DeleteImage(admd[0].logo);
        else logo = admd[0].logo;

        if (await DataUpdate(`tbl_lab_list`, `logo = '${logo}', name = '${name}', email = '${email}'`, `id = '${admd[0].id}'`, req.hostname, req.protocol) == -1) {

            if (req.file && logo != null) await AllFunction.DeleteImage(logo);
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        res.send({status: true, message: 'Profile Update Successfully'});
    } catch (error) {
        console.log(error);
        res.send({status: false, message: 'Internal Srever Error!'});
    }
});



// ============= FAQ ================ //

router.get("/faq",auth, async(req, res)=>{
    try {
        const faq_list = await DataFind(`SELECT * FROM tbl_list_faq`);
        
        res.render("faq", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, faq_list
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_faq", async(req, res)=>{
    try {
        const {title, description} = req.body;

        const faq_faq_title = mysql.escape(title);
        const faq_faq_des = mysql.escape(description);

        if ( await DataInsert(`tbl_list_faq`, `title, description`, `${faq_faq_title}, ${faq_faq_des}`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'FAQ Add successfully');
        res.redirect("/settings/faq");
    } catch (error) {
        console.error(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post('/edit_faq/:id', async (req, res) => {
    try {
        const {title, description} = req.body;
            
        const faq_faq_title = mysql.escape(title);
        const faq_faq_des = mysql.escape(description);
    
        if (await DataUpdate(`tbl_list_faq`, `title = ${faq_faq_title}, description = ${faq_faq_des}`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'FAQ Updated successfully');
        res.redirect("/settings/faq");
    } catch (error) {
        console.error(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get('/delete_faq/:id', async (req, res) => {
    try {
        if (await DataDelete(`tbl_list_faq`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
  
        req.flash('success', 'FAQ Deleted successfully');
        res.redirect("/settings/faq");
    } catch (error) {
        console.error(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

// ============= Banner ================ //

router.get("/banner", auth, async(req, res)=>{
    try {
        const department_list = await DataFind(`SELECT * FROM tbl_department_list WHERE status = '1'`);
        const banner_data = await DataFind(`SELECT tbl_banner.*,
                                            COALESCE(tbl_department_list.name, '') AS department_name
                                            FROM tbl_banner
                                            LEFT JOIN tbl_department_list on tbl_banner.department = tbl_department_list.id`);

        res.render("banner", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, department_list, banner_data
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_banner", auth, banner.single('image'), async(req, res)=>{
    try {
        const {title, sub_title, department} = req.body;

        const imageUrl = req.file ? "uploads/banner/" + req.file.filename : null;

        if (await DataInsert(`tbl_banner`, `image, department, title, sub_title`, `'${imageUrl}', '${department}', '${title}', '${sub_title}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Banner Add successfully');
        res.redirect("/settings/banner");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_banner/:id", auth, banner.single('image'), async(req, res)=>{
    try {
        const {title, sub_title, department, old_img} = req.body;

        const imageUrl = req.file ? "uploads/banner/" + req.file.filename : old_img;

        if (await DataUpdate(`tbl_banner`, `image = '${imageUrl}', department = '${department}', title = '${title}', sub_title = '${sub_title}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Banner Updated successfully');
        res.redirect("/settings/banner");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete_banner/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_banner`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Banner Deleted successfully');
        res.redirect("/settings/banner");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Payment Data ================ //

router.get("/payment", auth, async(req, res)=>{
    try {
        const payment_data = await DataFind(`SELECT * FROM tbl_payment_detail`);
        
        // if (await DataInsert(`tbl_payment_detail`, `image, name, sub_title, attribute, status, wallet_status`,
        //     `'uploads/payment_image/1726051224285download.png', 'Cash', 'Cash pay', '', '1', '0'`, req.hostname, req.protocol) == -1) {
        
        //     req.flash('errors', process.env.dataerror);
        //     return res.redirect("/valid_license");
        // }

        res.render("payment_detail", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, payment_data
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/add_payment/:id", auth, async(req, res)=>{
    try {
        const payment_data = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '${req.params.id}'`);
        let attribute = payment_data[0].attribute.split(",");
        
        res.render("payment_detail_data", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, payment_data, attribute
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_payment_data", payment.single('image'), async(req, res)=>{
    try {
        const {name, sub_title, attribute, status, wallet_status} = req.body;

        const imageUrl = req.file ? "uploads/payment_image/" + req.file.filename : null;
        const wstatus_no = wallet_status == "on" ? 1 : 0;

        if (await DataInsert(`tbl_payment_detail`, `image, name, sub_title, attribute, status, wallet_status`,
            `'${imageUrl}', '${name}', '${sub_title}', '${attribute}', '${status}', '${wstatus_no}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        res.status(200).json({ message: 'Payment Data Add successful', status:true });
    } catch (error) {
        console.log(error);
    }
});

router.post("/edit_payment_data/:id", auth, payment.single('image'), async(req, res)=>{
    try {
        const {sub_title, attribute, status, wallet_status, old_image} = req.body;

        const imageUrl = req.file ? "uploads/payment_image/" + req.file.filename : old_image;
        const wstatus_no = wallet_status == "on" ? 1 : 0;

        if (await DataUpdate(`tbl_payment_detail`,
            `image = '${imageUrl}', sub_title = '${sub_title}', attribute = '${attribute}', status = '${status}', wallet_status = '${wstatus_no}'`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Payment Data Updated successfully');
        res.redirect("/settings/payment");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

// ============= Add Card ================ //

router.get("/pages", auth, async(req, res)=>{
    try {
        const pages_data = await DataFind(`SELECT * FROM tbl_pages`);
        
        res.render("pages", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, pages_data
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/add_pages/:id", auth, async(req, res)=>{
    try {
        const pages_data = await DataFind(`SELECT * FROM tbl_pages where id = '${req.params.id}'`);
        
        res.render("add_pages", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, pages_data
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/pages_data/:id", auth, async(req, res)=>{
    try {
        const { title, status, paged } = req.body;

        const etitle = mysql.escape(title);
        const edes = mysql.escape(paged);

        if (await DataUpdate(`tbl_pages`, `title = ${etitle}, status = '${status}', description = ${edes}`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Pages Updated successfully');
        res.redirect("/settings/pages");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Notification ================ //

router.get("/send_notification", auth, async(req, res)=>{
    try {
        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE status = '1' ORDER BY id DESC`);
        const doctor = await DataFind(`SELECT * FROM tbl_doctor_list WHERE status = '1' ORDER BY id DESC`);
        const lab = await DataFind(`SELECT * FROM tbl_lab_list WHERE status = '1' ORDER BY id DESC`);

        const ndata = await DataFind(`SELECT noti.*, COALESCE(cus.name, '') AS cus_name, COALESCE(doc.name, '') AS doc_name, COALESCE(lab.name, '') AS lab_name
                                        FROM tbl_send_notification AS noti
                                        LEFT JOIN tbl_customer AS cus ON cus.id = noti.customer AND noti.customer != '' AND noti.customer != 'All'
                                        LEFT JOIN tbl_doctor_list AS doc ON doc.id = noti.doctor AND noti.doctor != '' AND noti.doctor != 'All'
                                        LEFT JOIN tbl_lab_list AS lab ON lab.id = noti.lab AND noti.lab != '' AND noti.lab != 'All'
                                        ORDER BY noti.id DESC`);

        res.render("send_notification", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, customer, doctor, lab, ndata
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/snotification", auth, notification.single('image'), async(req, res)=>{
    try {
        const {title, description, selecttype, customer, allcustomer, doctor, alldoctor, lab, alllab, status} = req.body;

        console.log(req.body);
        
        const imageUrl = req.file ? "uploads/send_notification/" + req.file.filename : '';

        let cid = "", did = "", lid = '', cdata = [], ddata = [], ldata = [];
        if (selecttype == "2") {
            if(allcustomer == "on") {
                cid = "All"; cdata = await DataFind(`SELECT id FROM tbl_customer WHERE status = '1' ORDER BY id DESC`);
            } else if (customer != undefined) {
                cid = customer; cdata = [{ id: customer}];
            }

            if(alldoctor == "on") {
                did = "All"; ddata = await DataFind(`SELECT id FROM tbl_doctor_list WHERE status = '1' ORDER BY id DESC`);
            } else if(doctor != undefined) {
                did = doctor; ddata = [{ id: doctor }];
            }

            if(alllab == "on") {
                lid = "All"; ldata = await DataFind(`SELECT id FROM tbl_lab_list WHERE status = '1' ORDER BY id DESC`);
            } else if(lab != undefined) {
                lid = lab; ldata = [{ id: lab }];
            }
        } else {
            cid = "All"; did = "All"; lid = "All"
            cdata = await DataFind(`SELECT id FROM tbl_customer WHERE status = '1' ORDER BY id DESC`);
            ddata = await DataFind(`SELECT id FROM tbl_doctor_list WHERE status = '1' ORDER BY id DESC`);
            ldata = await DataFind(`SELECT id FROM tbl_lab_list WHERE status = '1' ORDER BY id DESC`);
        }
        
        let data = {title:title, description:description, imageUrl:imageUrl, protocol: req.protocol, hostname: req.hostname};
        
        sendNotification(cdata, ddata, ldata, data, req.protocol, req.hostname);

        if (await DataInsert(`tbl_send_notification`, `image, title, description, customer, doctor, lab, count, status`,
            `'${imageUrl}', '${title}', '${description}', '${cid}', '${did}', '${lid}', '1', '1'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Notification Send successfully');
        res.redirect("/settings/send_notification");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

function sendNotification(cdata, ddata, ldata, data, protocol, hostname) {

    if (cdata.length > 0 && cdata[0].id != undefined) {
        cdata.forEach(cval => {
            sendOneNotification("", 'customer', cval.id, 1, data, protocol, hostname);
            sendOneNotification("", 'customer', cval.id, 2, data, protocol, hostname);
        });
    }

    if (ddata.length > 0 && ddata[0].id != undefined) {
        ddata.forEach(dval => {
            sendOneNotification("", 'doctor', dval.id, data, 1, protocol, hostname);
        });
    }

    if (ldata.length > 0 && ldata[0].id != undefined) {
        ldata.forEach(lval => {
            sendOneNotification("", 'lab', lval.id, data, 1, protocol, hostname);
        });
    }

}

router.get("/neresend/:id", auth, async(req, res)=>{
    try {
        const ndata = await DataFind(`SELECT * FROM tbl_send_notification WHERE id = '${req.params.id}'`);

        if (ndata[0].status == "1") {

            let cdata = [], ddata = [], ldata = [];
            if(ndata[0].customer == "All") {
                cdata = await DataFind(`SELECT id FROM tbl_customer WHERE status = '1' ORDER BY id DESC`);
            } else if (ndata[0].customer != undefined) {
                cdata = [{ id: ndata[0].customer}];
            }

            if(ndata[0].doctor == "All") {
                ddata = await DataFind(`SELECT id FROM tbl_doctor_list WHERE status = '1' ORDER BY id DESC`);
            } else if(ndata[0].doctor != undefined) {
                ddata = [{ id: ndata[0].doctor }];
            }

            if(ndata[0].lab == "All") {
                ldata = await DataFind(`SELECT id FROM tbl_lab_list WHERE status = '1' ORDER BY id DESC`);
            } else if(ndata[0].lab != undefined) {
                ldata = [{ id: ndata[0].lab }];
            }

            let count = parseFloat(ndata[0].count) + parseFloat(1);

            if (await DataUpdate(`tbl_send_notification`, `count = '${count}'`, `id = '${ndata[0].id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        
            let data = {title: ndata[0].title, description: ndata[0].description, imageUrl: ndata[0].image, protocol: req.protocol, hostname: req.hostname};
        
            sendNotification(cdata, ddata, ldata, data, req.protocol, req.hostname);
    
            req.flash('success', 'Notification Send successfully');
        } else {
            req.flash('errors', 'Notification Deactivated');
        }
        res.redirect("/settings/send_notification");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



router.get("/sendit/:id", auth, async(req, res)=>{
    try {
        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE status = '1' ORDER BY id DESC`);
        const doctor = await DataFind(`SELECT * FROM tbl_doctor_list WHERE status = '1' ORDER BY id DESC`);
        const lab = await DataFind(`SELECT * FROM tbl_lab_list WHERE status = '1' ORDER BY id DESC`);

        const ndata = await DataFind(`SELECT * FROM tbl_send_notification WHERE id = '${req.params.id}'`);

        if (ndata == '') {
            req.flash('errors', `Data not found!`);
            return res.redirect("back");
        }

        res.render("send_notification_edit", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, customer, doctor, lab, ndata:ndata[0]
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/editsend/:id", auth, notification.single('image'), async(req, res)=>{
    try {
        const {title, description, selecttype, customer, allcustomer, doctor, alldoctor, lab, alllab, status} = req.body;

        let cid = "", did = "", lid = '';
        if (selecttype == "2") {
            if(allcustomer == "on") cid = "All";
            else if (customer != undefined) cid = customer;

            if(alldoctor == "on") did = "All"; 
            else if(doctor != undefined) did = doctor; 

            if(alllab == "on") lid = "All"; 
            else if(lab != undefined) lid = lab;
        } else {
            cid = "All"; did = "All"; lid = "All"
        }

        const ndata = await DataFind(`SELECT * FROM tbl_send_notification WHERE id = '${req.params.id}'`);
        const imageUrl = req.file ? "uploads/send_notification/" + req.file.filename : ndata[0].image;

        let nstatus = status == "on" ? "1" : "0";

        if (await DataUpdate(`tbl_send_notification`,
            `image = '${imageUrl}', title = '${title}', description = '${description}', customer = '${cid}', doctor = '${did}', lab = '${lid}', count = '${ndata[0].count}', 
            status = '${nstatus}'`, `id = '${ndata[0].id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Notification Updated successfully');
        res.redirect("/settings/send_notification");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/ndelete/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_send_notification`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Notification Deleted successfully');
        res.redirect("/settings/send_notification");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Appointment cacncel list ================ //

router.get("/appointment_cancel_list", auth, async(req, res)=>{
    try {
        const diagnosis_list = await DataFind(`SELECT * FROM tbl_appointment_cancel_list ORDER BY id DESC`);

        res.render('appoint_cancel_list', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, diagnosis_list
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_cancel_reason", auth, async(req, res)=>{
    try {
        const { text, status } = req.body;
        
        const estitele = mysql.escape(text), statuss = status == "on" ? 1 : 0;

        if (await DataInsert(`tbl_appointment_cancel_list`, `title, status`, `${estitele}, '${statuss}'`, 
            req.hostname, req.protocol) == -1) {

            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Appointment cancel reason Add successfully');
        res.redirect("/settings/appointment_cancel_list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_cancel_reason/:id", auth, async(req, res)=>{
    try {
        const { text, status } = req.body;
        
        const estitele = mysql.escape(text), statuss = status == "on" ? 1 : 0;

        if (await DataUpdate(`tbl_appointment_cancel_list`, `title = ${estitele}, status = '${statuss}'`, `id = '${req.params.id}'`, 
            req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Appointment cancel reason edit successfully');
        res.redirect("/settings/appointment_cancel_list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete_cancel_reason/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_appointment_cancel_list`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Appointment cancel reason delete successfully');
        res.redirect("/settings/appointment_cancel_list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});





// ============= Cash Management ================ //

router.get("/lab_cash_manage", auth, async(req, res)=>{
    try {
        const pay_his = await DataFind(`SELECT lca.id, lca.lab_id, lca.status, lca.proof_image, lca.amount, lca.date, lca.payment_type, lca.c_status,
                                        COALESCE(lab.name) AS labname
                                        FROM tbl_lab_cash_adjust AS lca
                                        LEFT JOIN tbl_lab_list AS lab ON lab.id = lca.lab_id
                                        WHERE lca.status = '2' ORDER BY lca.id DESC`);
                                    
        pay_his.map(async(val) => {
            val.date = AllFunction.NotificationDate(val.date);
            delete val.appointment_time;
        });
        
        res.render('lab_admin_cash_manage', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, pay_his
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/accept_lab_cash", auth, async(req, res)=>{
    try {
        const { id } = req.body;
        
        if (await DataUpdate(`tbl_lab_cash_adjust`, `c_status = '2'`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        res.send({ status: true, message: 'Cash Amount Request Accepeted', approve: req.lan.ld.Approve });
    } catch (error) {
        console.log(error);
        res.send({ status: false, message: 'Internal Server Error!' });
    }
});

router.post("/reject_lab_cash", auth, async(req, res)=>{
    try {
        const { id } = req.body;
        
        const doctor = await DataFind(`SELECT id, lab_id, amount FROM tbl_lab_cash_adjust WHERE id = '${id}'`);
        if(doctor == '') return res.send({ status: false, message: 'Request Not Found!' });

        const lab = await DataFind(`SELECT id, cash_amount, success_cash FROM tbl_lab_list WHERE id = '${doctor[0].lab_id}'`);
        if(lab == '') return res.send({ status: false, message: 'User Not Found!' });

        let cash_total = parseFloat((Number(lab[0].cash_amount) + Number(doctor[0].amount)).toFixed(2));
        let success_cash = parseFloat((Number(lab[0].success_cash) - Number(doctor[0].amount)).toFixed(2));

        if (await DataUpdate(`tbl_lab_list`, `cash_amount = '${cash_total}', success_cash = '${success_cash}'`, `id = '${lab[0].id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        if (await DataUpdate(`tbl_lab_cash_adjust`, `c_status = '3'`, `id = '${doctor[0].id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        res.send({ status: true, message: 'Cash Request Rejected', reject: req.lan.ld.Reject });
    } catch (error) {
        console.log(error);
        res.send({ status: false, message: 'Internal Server Error!' });
    }
});

router.post("/accept_lab_cash", auth, async(req, res)=>{
    try {
        const { id } = req.body;
        
        if (await DataUpdate(`tbl_lab_cash_adjust`, `c_status = '2'`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        res.send({ status: true, message: 'Cash Amount Request Accepeted', approve: req.lan.ld.Approve });
    } catch (error) {
        console.log(error);
        res.send({ status: false, message: 'Internal Server Error!' });
    }
});

router.post("/reject_lab_cash", auth, async(req, res)=>{
    try {
        const { id } = req.body;
        
        const doctor = await DataFind(`SELECT id, lab_id, amount FROM tbl_lab_cash_adjust WHERE id = '${id}'`);
        if(doctor == '') return res.send({ status: false, message: 'Request Not Found!' });

        const lab = await DataFind(`SELECT id, cash_amount, success_cash FROM tbl_lab_list WHERE id = '${doctor[0].lab_id}'`);
        if(lab == '') return res.send({ status: false, message: 'User Not Found!' });
        
        let cash_total = parseFloat((Number(lab[0].cash_amount) + Number(doctor[0].amount)).toFixed(2));
        let success_cash = parseFloat((Number(lab[0].success_cash) - Number(doctor[0].amount)).toFixed(2));

        if (await DataUpdate(`tbl_lab_list`, `cash_amount = '${cash_total}', success_cash = '${success_cash}'`, `id = '${lab[0].id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        if (await DataUpdate(`tbl_lab_cash_adjust`, `c_status = '3'`, `id = '${doctor[0].id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        res.send({ status: true, message: 'Cash Request Rejected', reject: req.lan.ld.Reject });
    } catch (error) {
        console.log(error);
        res.send({ status: false, message: 'Internal Server Error!' });
    }
});


router.get("/doctor_cash_manage", auth, async(req, res)=>{
    try {
        const pay_his = await DataFind(`SELECT dca.id, dca.doctor_id, dca.status, dca.proof_image, dca.amount, dca.date, dca.payment_type, dca.c_status,
                                        COALESCE(doc.name) AS docname
                                        FROM tbl_doctor_cash_adjust AS dca
                                        LEFT JOIN tbl_doctor_list AS doc ON doc.id = dca.doctor_id
                                        WHERE dca.status = '2' ORDER BY dca.id DESC`);

        pay_his.map(async(val) => {
            val.date = AllFunction.NotificationDate(val.date);
        });

        res.render('doctor_admin_cash_manage', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, pay_his
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});


router.post("/accept_doctor_cash", auth, async(req, res)=>{
    try {
        const { id } = req.body;
        
        if (await DataUpdate(`tbl_doctor_cash_adjust`, `c_status = '2'`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        res.send({ status: true, message: 'Cash Amount Request Accepeted', approve: req.lan.ld.Approve });
    } catch (error) {
        console.log(error);
        res.send({ status: false, message: 'Internal Server Error!' });
    }
});

router.post("/reject_doctor_cash", auth, async(req, res)=>{
    try {
        const { id } = req.body;

        const dcash = await DataFind(`SELECT id, doctor_id, amount FROM tbl_doctor_cash_adjust WHERE id = '${id}'`);
        if(dcash == '') return res.send({ status: false, message: 'Request Not Found!' });

        const doctor = await DataFind(`SELECT id, cash_amount, success_cash FROM tbl_doctor_list WHERE id = '${dcash[0].doctor_id}'`);
        if(doctor == '') return res.send({ status: false, message: 'User Not Found!' });
        
        let cash_total = parseFloat((Number(doctor[0].cash_amount) + Number(dcash[0].amount)).toFixed(2));
        let success_cash = parseFloat((Number(doctor[0].success_cash) - Number(dcash[0].amount)).toFixed(2));

        if (await DataUpdate(`tbl_doctor_list`, `cash_amount = '${cash_total}', success_cash = '${success_cash}'`, `id = '${doctor[0].id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        if (await DataUpdate(`tbl_doctor_cash_adjust`, `c_status = '3'`, `id = '${dcash[0].id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        res.send({ status: true, message: 'Cash Request Rejected', reject: req.lan.ld.Reject });
    } catch (error) {
        console.log(error);
        res.send({ status: false, message: 'Internal Server Error!' });
    }
});



// ============= Sitter Withdraw ================ //

router.get("/doc_payout_list", auth, async(req, res)=>{
    try {
        const pay_list = await DataFind(`SELECT dpa.id, dpa.appointment_id, dpa.doctor_id, dpa.amount, dpa.date, dpa.status, dpa.p_status, dpa.image, dpa.p_type, dpa.upi_id, 
                                    dpa.paypal_id, dpa.bank_no, dpa.bank_ifsc, dpa.bank_type, COALESCE(doc.name, '') AS doc_name, COALESCE(doc.email, '') AS doc_email
                                    FROM tbl_doctor_payout_adjust AS dpa
                                    LEFT JOIN tbl_doctor_list AS doc ON doc.id = dpa.doctor_id
                                    WHERE dpa.status = '2' ORDER BY dpa.id DESC;`);
        
        pay_list.forEach(item => {
            item.date = new Date(item.date).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        });
        
        res.render("admin_doc_payout_list", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, pay_list
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/admin_doc_pay_data", auth, async(req, res)=>{
    try {
        const {id} = req.body;
        
        const pay_list = await DataFind(`SELECT dpa.id, dpa.appointment_id, dpa.doctor_id, dpa.amount, dpa.date, dpa.status, dpa.p_status, dpa.image, dpa.p_type, dpa.upi_id, 
                                        dpa.paypal_id, dpa.bank_no, dpa.bank_ifsc, dpa.bank_type, COALESCE(doc.name, '') AS doc_name, COALESCE(doc.email, '') AS doc_email
                                        FROM tbl_doctor_payout_adjust AS dpa
                                        LEFT JOIN tbl_doctor_list AS doc ON doc.id = dpa.doctor_id
                                        WHERE dpa.id = '${id}' AND dpa.status = '2' ORDER BY dpa.id DESC;`);
        
        res.send({ status: pay_list != '' ? true : false, message: pay_list != '' ? '' : 'Data not found!', pay_list })
    } catch (error) {
        console.log(error);
        res.send({ status: false, message: 'Internal Server Error!' });
    }
});

AllFunction.ImageUploadFolderCheck(`./public/uploads/payout_doctor_list`);
const storage3 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/payout_doctor_list");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const payout = multer({storage : storage3});

router.post("/add_wpayment", auth, payout.single('image'), async(req, res)=>{
    const imageUrl = req.file ? "uploads/payout_doctor_list/" + req.file.filename : null;
    
    try {
        const {id} = req.body;
        
        const pay = await DataFind(`SELECT id FROM tbl_doctor_payout_adjust WHERE id = '${id}'`);
        if (pay != '') {
            if (await DataUpdate(`tbl_doctor_payout_adjust`, `image = '${imageUrl}', p_status = '1'`, `id = '${pay[0].id}'`, req.hostname, req.protocol) == -1) {
            
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            return res.send({ status: true, message: "Payout Provide Suucessfully", imageUrl, paid: req.lan.ld.Paid });
        }

        if (req.file) await AllFunction.DeleteImage(imageUrl);
        return res.send({ status: false, message: "Data not found!" });
    } catch (error) {
        console.log(error);
        if (req.file) await AllFunction.DeleteImage(imageUrl);
        return res.send({ status: false, message: 'Internal Server Error!' });
    }
});





router.get("/medicine_payout_list", auth, async(req, res)=>{
    try {
        const pay_list = await DataFind(`SELECT dpa.id, dpa.order_id, dpa.doctor_id, dpa.amount, dpa.date, dpa.status, dpa.p_status, dpa.image, dpa.p_type, dpa.upi_id, 
                                    dpa.paypal_id, dpa.bank_no, dpa.bank_ifsc, dpa.bank_type, COALESCE(doc.name, '') AS doc_name, COALESCE(doc.email, '') AS doc_email
                                    FROM tbl_doctor_product_payout_adjust AS dpa
                                    LEFT JOIN tbl_doctor_list AS doc ON doc.id = dpa.doctor_id
                                    WHERE dpa.status = '2' ORDER BY dpa.id DESC;`);
        
        pay_list.forEach(item => {
            item.date = new Date(item.date).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        });
        
        res.render("admin_medi_payout_list", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, pay_list
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/admin_medicine_pay_data", auth, async(req, res)=>{
    try {
        const {id} = req.body;
        
        const pay_list = await DataFind(`SELECT dpa.id, dpa.order_id, dpa.doctor_id, dpa.amount, dpa.date, dpa.status, dpa.p_status, dpa.image, dpa.p_type, dpa.upi_id, 
                                        dpa.paypal_id, dpa.bank_no, dpa.bank_ifsc, dpa.bank_type, COALESCE(doc.name, '') AS doc_name, COALESCE(doc.email, '') AS doc_email
                                        FROM tbl_doctor_product_payout_adjust AS dpa
                                        LEFT JOIN tbl_doctor_list AS doc ON doc.id = dpa.doctor_id
                                        WHERE dpa.id = '${id}' AND dpa.status = '2' ORDER BY dpa.id DESC;`);
        
        res.send({ status: pay_list != '' ? true : false, message: pay_list != '' ? '' : 'Data not found!', pay_list });
    } catch (error) {
        console.log(error);
        res.send({ status: false, message: 'Internal Server Error!' });
    }
});

AllFunction.ImageUploadFolderCheck(`./public/uploads/payout_medicine_list`);
const storage5 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/payout_medicine_list");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const medi_payout = multer({storage : storage5});

router.post("/add_medi_pay_data", auth, medi_payout.single('image'), async(req, res)=>{
    const imageUrl = req.file ? "uploads/payout_medicine_list/" + req.file.filename : null;
    try {
        const {id} = req.body;
        
        const pay = await DataFind(`SELECT id FROM tbl_doctor_product_payout_adjust WHERE id = '${id}'`);
        if (pay != '') {
            if (await DataUpdate(`tbl_doctor_product_payout_adjust`, `image = '${imageUrl}', p_status = '1'`, `id = '${pay[0].id}'`, req.hostname, req.protocol) == -1) {
            
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            return res.send({ status: true, message: "Payout Provide Suucessfully", imageUrl, paid: req.lan.ld.Paid });
        }

        if (req.file) await AllFunction.DeleteImage(imageUrl);
        return res.send({ status: false, message: "Data not found!" });
    } catch (error) {
        console.log(error);
        if (req.file) await AllFunction.DeleteImage(imageUrl);
        return res.send({ status: false, message: 'Internal Server Error!' });
    }
});



router.get("/lab_payout_list", auth, async(req, res)=>{
    try {
        const pay_list = await DataFind(`SELECT dpa.id, dpa.appointment_id, dpa.lab_id, dpa.amount, dpa.date, dpa.status, dpa.p_status, dpa.image, dpa.p_type, dpa.upi_id, 
                                    dpa.paypal_id, dpa.bank_no, dpa.bank_ifsc, dpa.bank_type, COALESCE(lab.name, '') AS lab_name, COALESCE(lab.email, '') AS lab_email
                                    FROM tbl_lab_payout_adjust AS dpa
                                    LEFT JOIN tbl_lab_list AS lab ON lab.id = dpa.lab_id
                                    WHERE dpa.status = '2' ORDER BY dpa.id DESC;`);
        
        pay_list.forEach(item => {
            item.date = new Date(item.date).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        });
        
        res.render("admin_lab_payout_list", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, pay_list
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/admin_lab_pay_data", auth, async(req, res)=>{
    try {
        const {id} = req.body;
        
        const pay_list = await DataFind(`SELECT dpa.id, dpa.appointment_id, dpa.lab_id, dpa.amount, dpa.date, dpa.status, dpa.p_status, dpa.image, dpa.p_type, dpa.upi_id, 
                                        dpa.paypal_id, dpa.bank_no, dpa.bank_ifsc, dpa.bank_type, COALESCE(lab.name, '') AS lab_name, COALESCE(lab.email, '') AS lab_email
                                        FROM tbl_lab_payout_adjust AS dpa
                                        LEFT JOIN tbl_lab_list AS lab ON lab.id = dpa.lab_id
                                        WHERE dpa.status = '2' AND dpa.id = '${id}' ORDER BY dpa.id DESC;`);
        
        res.send({ status: pay_list != '' ? true : false, message: pay_list != '' ? '' : 'Data not found!', pay_list });
    } catch (error) {
        console.log(error);
        res.send({ status: false, message: 'Internal Server Error!' });
    }
});

AllFunction.ImageUploadFolderCheck(`./public/uploads/payout_lab_list`);
const storage6 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/payout_lab_list");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const lab_payout = multer({storage : storage6});

router.post("/add_lab_pay_data", auth, lab_payout.single('image'), async(req, res)=>{
    const imageUrl = req.file ? "uploads/payout_lab_list/" + req.file.filename : null;
    try {
        const {id} = req.body;
        
        const pay = await DataFind(`SELECT id FROM tbl_lab_payout_adjust WHERE id = '${id}'`);
        
        if (pay != '') {
            if (await DataUpdate(`tbl_lab_payout_adjust`, `image = '${imageUrl}', p_status = '1'`, `id = '${pay[0].id}'`, req.hostname, req.protocol) == -1) {
            
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            return res.send({ status: true, message: "Payout Provide Suucessfully", imageUrl, paid: req.lan.ld.Paid });
        }

        if (req.file) await AllFunction.DeleteImage(imageUrl);
        return res.send({ status: false, message: "Data not found!" });
    } catch (error) {
        console.log(error);
        if (req.file) await AllFunction.DeleteImage(imageUrl);
        return res.send({ status: false, message: 'Internal Server Error!' });
    }
});





module.exports = router;