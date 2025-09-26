/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const multer  = require('multer');
let mysql = require('mysql');
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");
const AllFunction = require("../route_function/function");
const bcrypt = require('bcrypt');
const sendOneNotification = require("../middleware/send");
const countryCodes = require('country-codes-list');



AllFunction.ImageUploadFolderCheck(`./public/uploads/lab_banner`);
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/lab_banner");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const lab_banner = multer({storage : storage});



// ============= Lab booking ================ //

router.get("/appoint/list", auth, async(req, res)=>{
    try {
        const bl = await DataFind(`SELECT lb.id, lb.customer_id, lb.status, lb.book_date, lb.book_time, lb.tot_price, lb.paid_amount, lb.wallet_amount, lb.home_extra_price,
                                    lb.home_col_status, COALESCE(cus.name, '') AS cus_name, COALESCE(pay.name, '') AS payment_name, COALESCE(lhcu.name, '') AS home_c_user,
                                    JSON_OBJECT(
                                        's', CASE
                                            WHEN lb.status = '1' THEN '${req.lan.ld.Pending || ''}'
                                            WHEN lb.status = '2' THEN '${req.lan.ld.Accepted || ''}'
                                            WHEN lb.status = '3' THEN '${req.lan.ld.Assign} ${req.lan.ld.User || ''}'
                                            WHEN lb.status = '4' THEN '${req.lan.ld.Ongoing || ''}'
                                            WHEN lb.status = '5' THEN '${req.lan.ld.In_Progress || ''}'
                                            WHEN lb.status = '6' THEN '${req.lan.ld.Completed || ''}'
                                            WHEN lb.status = '7' THEN '${req.lan.ld.Canceled || ''}'
                                            ELSE ''
                                        END,
                                        'b', CASE
                                            WHEN lb.status = '1' THEN 'btn-warning'
                                            WHEN lb.status = '2' THEN 'btn-info'
                                            WHEN lb.status = '3' THEN 'btn-secondary'
                                            WHEN lb.status = '4' THEN 'btn-dark'
                                            WHEN lb.status = '5' THEN 'btn-primary'
                                            WHEN lb.status = '6' THEN 'btn-success'
                                            WHEN lb.status = '7' THEN 'btn-danger'
                                            ELSE ''
                                        END
                                    ) AS status_title
                                    FROM tbl_lab_booking AS lb
                                    LEFT JOIN tbl_customer AS cus ON cus.id = lb.customer_id
                                    LEFT JOIN tbl_payment_detail AS pay ON pay.id = lb.payment_id
                                    LEFT JOIN tbl_lab_home_collect_user AS lhcu ON lhcu.id = lb.home_collect_user_id
                                    ${req.user.admin_role != 1 ? `WHERE lb.lab_id = "${req.user.admin_id}"` : `` } 
                                    ORDER BY lb.id DESC;`);
        
        const user_list = await DataFind(`SELECT id, name FROM tbl_lab_home_collect_user WHERE lab_id = '${req.user.admin_id}' AND status = '1'`);   
        
        const cr = await DataFind(`SELECT id, title FROM tbl_appointment_cancel_list WHERE status = '1' ORDER BY id DESC;`);
        
        res.render("list_lab_booking", {
            auth:req.user, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, general:req.general, bl, user_list, cr
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

async function sDateFormate(date) {
    return new Date(date).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
}

router.get("/booking_details/:id", auth, async(req, res)=>{
    try {
        const appoint = await DataFind(`SELECT lb.id, lb.customer_id, lb.lab_id, lb.category_id, lb.status, lb.date, lb.book_date, lb.book_time, lb.message, lb.address, 
                                        lb.tot_price, lb.tot_package_price, lb.paid_amount, lb.coupon_id, lb.coupon_amount, lb.home_extra_price, 
                                        lb.site_commission, lb.payment_id, lb.wallet_amount, lb.home_col_status, 0 AS online_amount, 0 AS cash_amount, 
                                        COALESCE(pd.name, '') AS payment_name, COALESCE(pd.image, '') AS payment_image, COALESCE(lhcu.name, '') AS home_c_user, 
                                        COALESCE(lhcu.email, '') AS home_c_email, COALESCE(lhcu.country_code, '') AS home_c_ccode, COALESCE(lhcu.phone, '') AS home_c_phone,
                                        COALESCE(cl.title, '') AS cancel_title, COALESCE(lb.cancel_reason, '') AS cancel_reason, lb.transactionId, lb.status_list,
                                        JSON_ARRAYAGG(
                                            JSON_OBJECT(
                                                'pid', p.pid, 
                                                'logo', pkg.logo,
                                                'title', pkg.title,
                                                'subtitle', pkg.subtitle,
                                                'package_type', pkg.package_type,
                                                'package_name', pkg.package_name,
                                                'package_price', pkg.package_price,
                                                'f', (
                                                    SELECT JSON_ARRAYAGG(
                                                        JSON_OBJECT(
                                                            'c', f.c,
                                                            'd', f.d,
                                                            'r', f.r, 
                                                            'id', JSON_OBJECT(
                                                                'id', fm.id, 
                                                                'profile_image', fm.profile_image,
                                                                'name', fm.name
                                                            )
                                                        )
                                                    )
                                                    FROM JSON_TABLE(p.f, '$[*]' COLUMNS(
                                                        id INT PATH '$.id',
                                                        c VARCHAR(255) PATH '$.c',
                                                        d VARCHAR(255) PATH '$.d',
                                                        r JSON PATH '$.r'
                                                    )) AS f
                                                    JOIN tbl_family_member fm ON f.id = fm.id
                                                )
                                            )
                                        ) AS package_id,
                                        JSON_OBJECT(
                                            's', CASE
                                                WHEN lb.status = '1' THEN '${req.lan.ld.Pending}'
                                                WHEN lb.status = '2' THEN '${req.lan.ld.Accepted}'
                                                WHEN lb.status = '3' THEN '${req.lan.ld.Assign} ${req.lan.ld.User}'
                                                WHEN lb.status = '4' THEN '${req.lan.ld.Ongoing}'
                                                WHEN lb.status = '5' THEN '${req.lan.ld.In_Progress}'
                                                WHEN lb.status = '6' THEN '${req.lan.ld.Completed}'
                                                WHEN lb.status = '7' THEN '${req.lan.ld.Canceled}'
                                                ELSE ''
                                            END,
                                            'b', CASE
                                                WHEN lb.status = '1' THEN 'btn-warning'
                                                WHEN lb.status = '2' THEN 'btn-info'
                                                WHEN lb.status = '3' THEN 'btn-secondary'
                                                WHEN lb.status = '4' THEN 'btn-dark'
                                                WHEN lb.status = '5' THEN 'btn-primary'
                                                WHEN lb.status = '6' THEN 'btn-success'
                                                WHEN lb.status = '7' THEN 'btn-danger'
                                                ELSE ''
                                            END
                                        ) AS status_type
                                        FROM tbl_lab_booking lb
                                        JOIN JSON_TABLE(lb.package_id, '$[*]' COLUMNS(
                                            pid INT PATH '$.pid',
                                            f JSON PATH '$.f'
                                        )) AS p
                                        LEFT JOIN tbl_payment_detail AS pd ON pd.id = lb.payment_id
                                        LEFT JOIN tbl_lab_home_collect_user AS lhcu ON lhcu.id = lb.home_collect_user_id
                                        LEFT JOIN tbl_lab_package_list pkg ON p.pid = pkg.id
                                        LEFT JOIN tbl_appointment_cancel_list AS cl ON cl.id = lb.cancel_id AND lb.cancel_id != ''
                                        WHERE lb.id = '${req.params.id}' ${req.user.admin_role != 1 ? ` AND lb.lab_id = '${req.user.admin_id}'` : `` }
                                        GROUP BY lb.id;`);
        
        if (appoint == '') {
            req.flash('errors', `Appointment not found!`);
            return res.redirect("back");    
        }

        appoint[0].package_id = typeof appoint[0].package_id == 'string' ? JSON.parse(appoint[0].package_id) : appoint[0].package_id;
        appoint[0].status_list = typeof appoint[0].status_list == 'string' ? JSON.parse(appoint[0].status_list) : appoint[0].status_list;

        appoint[0].package_id.map(p => {
            p.f.map(pv => {
                if (pv.d != '') pv.d = new Date(pv.d).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
            });

            p.package_name = typeof p.package_name == 'string' ? JSON.parse(p.package_name) : p.package_name;
            p.package_price = typeof p.package_price == 'string' ? JSON.parse(p.package_price) : p.package_price;

            p.tot_package_name = p.package_type == "Individual" ? p.package_name.length : p.package_name.length;
            p.tot_package_price = p.package_type == "Individual" ? p.package_price[0] : p.package_price.reduce((p, obj) => p + obj, 0);

        });

        await Promise.all(
            appoint[0].status_list.map(async (p) => {
                p.t = await sDateFormate(p.t);
            })
        );
        appoint[0].status_list.sort((a, b) => a.s - b.s);

        const date = new Date(appoint[0].date);
        const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        
        appoint[0].date = formattedDate;

        if (appoint[0].payment_name != 'Cash') appoint[0].online_amount = Number((appoint[0].tot_price - appoint[0].wallet_amount).toFixed(2));
        else appoint[0].online_amount = 0;

        if (appoint[0].payment_name == 'Cash') appoint[0].cash_amount = Number((appoint[0].tot_price - appoint[0].paid_amount).toFixed(2));

        const customer = await DataFind(`SELECT lab.id, lab.image, lab.name, lab.email, lab.country_code, lab.phone
                                        FROM tbl_customer AS lab
                                        WHERE lab.id = '${appoint[0].customer_id}' AND lab.status = '1'`);
        
        if (customer == '') {
            req.flash('errors', `User not found!`);
            return res.redirect("back");    
        }

        const category = await DataFind(`SELECT id, image, name FROM tbl_lab_category WHERE id = '${appoint[0].category_id}' AND status = '1';`);
        
        let address = {};
        if (appoint[0].address != '') {
            const ad = await DataFind(`SELECT * FROM tbl_customer_address WHERE id = '${appoint[0].address}'`);
            address = ad[0];
        }

        const user_list = await DataFind(`SELECT id, name FROM tbl_lab_home_collect_user WHERE lab_id = '${req.user.admin_id}' AND status = '1'`);
        const cr = await DataFind(`SELECT id, title FROM tbl_appointment_cancel_list WHERE status = '1' ORDER BY id DESC;`);

        res.render("lab_booking_details", {
            auth:req.user, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, general:req.general, appoint: appoint[0], customer: customer != '' ? customer[0] : {}, 
            category: category[0] || {}, address, user_list, cr
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/web/lab_appoint_cancel", auth, async(req, res)=>{
    try {
        const {id, cul, oth} = req.body;
        
        const missingField = ["id", "cul"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Something Went Wrong!" });

        const appont = await DataFind(`SELECT id, customer_id, lab_id, otp, status, status_list, paid_amount FROM tbl_lab_booking WHERE id = '${id}'`);
        if (appont == '') return res.send({ status: false, message: "Appointment Not Found" });

        appont[0].status_list = typeof appont[0].status_list == "string" ? JSON.parse(appont[0].status_list) : appont[0].status_list;

        if (appont[0].status != 1) return res.send({ status: false, message: "Complete Other Steps" });

        let date = new Date();
        appont[0].status_list.push({ s:7, t: date.toISOString() });
    
        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${appont[0].customer_id}'`);
        if (customer == 1) return res.send({ status: false, message: "User Not Found" });

        if (appont[0].paid_amount > 0) {
            const tot_amount = customer[0].tot_balance + appont[0].paid_amount;
            
            if (await DataUpdate(`tbl_customer`, `tot_balance = '${tot_amount}'`, `id = '${customer[0].id}'`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
    
            if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                `'${customer[0].id}', '${appont[0].paid_amount}', '${date.toISOString().split("T")[0]}', '0', '5', '${appont[0].id}'`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }
    
        if (await DataUpdate(`tbl_lab_booking`, `status = '7', otp = '', status_list = '${JSON.stringify(appont[0].status_list)}', cancel_id = '${cul}',
            cancel_reason = ${mysql.escape(oth)}`, `id = '${appont[0].id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        let ms = `❌ Your lab appointment has been cancelled. For further details, please contact support. Appointment ID : # ${appont[0].id}`
        sendOneNotification(ms, 'customer', appont[0].customer_id, 1);
        sendOneNotification(ms, 'customer', appont[0].customer_id, 2);
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appont[0].id}', '${appont[0].customer_id}', '${appont[0].lab_id}', '${AllFunction.NotificationDate(date)}', '2', '7', '${ms}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        const cancel_data = await DataFind(`SELECT * FROM tbl_appointment_cancel_list WHERE id = '${cul}'`);

        return res.send({ status: true, message: "Appointment Cancel Successfully.", title: req.lan.ld.Canceled, time: await sDateFormate(date), cancel_data, oth });
    } catch (error) {
        console.log(error);
        return res.send({ status: false, message: "Internal Server Error!" });
    }
});

router.post("/web/lab_appoint_accept", auth, async(req, res)=>{
    try {
        const {id} = req.body;
        
        const missingField = ["id"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Something Went Wrong!" });

        const appont = await DataFind(`SELECT id, customer_id, lab_id, otp, status, status_list, home_extra_price FROM tbl_lab_booking WHERE id = '${id}'`);
        if (appont == '') return res.send({ status: false, message: "Appointment Not Found" });

        appont[0].status_list = typeof appont[0].status_list == "string" ? JSON.parse(appont[0].status_list) : appont[0].status_list;

        if (appont[0].status != 1) return res.send({ status: false, message: "Complete Other Steps" });

        let date = new Date().toISOString();
        appont[0].status_list.push({ s:2, t: date });

        let ns = appont[0].home_extra_price == 0 ? 4 : 3, user_list = [];

        if (await DataUpdate(`tbl_lab_booking`, `status = '2', otp = '${await AllFunction.otpGenerate(4)}', status_list = '${JSON.stringify(appont[0].status_list)}'`, 
            `id = '${appont[0].id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        let ms = `✅ Your lab appointment has been accepted. Appointment ID : # ${appont[0].id}`;
        sendOneNotification(ms, 'customer', appont[0].customer_id, 1);
        sendOneNotification(ms, 'customer', appont[0].customer_id, 2);
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appont[0].id}', '${appont[0].customer_id}', '${appont[0].lab_id}', '${AllFunction.NotificationDate(date)}', '2', '2', '${ms}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        if (ns == 3) user_list = await DataFind(`SELECT id, name FROM tbl_lab_home_collect_user WHERE lab_id = '${req.user.admin_id}' AND status = '1'`);

        return res.status(200).json({ status: true, message: "Appointment Accept Successfully.", ns, user_list, title: req.lan.ld.Accepted, time: await sDateFormate(date) });
    } catch (error) {
        console.log(error);
        return res.send({ status: false, message: "Internal Server Error!" });
    }
});

router.post("/web/lab_appoint_assi_coll", auth, async(req, res)=>{
    try {
        const {id, cul} = req.body;

        const missingField = ["id", "cul"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Something Went Wrong!" });

        const appont = await DataFind(`SELECT id, customer_id, lab_id, otp, status, status_list, home_extra_price FROM tbl_lab_booking WHERE id = '${id}'`);
        const ul = await DataFind(`SELECT * FROM tbl_lab_home_collect_user WHERE id = '${cul}' AND status = '1'`);

        if (appont == '' || ul == '') return res.send({ status: false, message: "Appointment Not Found" });

        appont[0].status_list = typeof appont[0].status_list == "string" ? JSON.parse(appont[0].status_list) : appont[0].status_list;

        if (appont[0].status != 2) return res.send({ status: false, message: "Complete Other Steps" });

        let date = new Date().toISOString();
        appont[0].status_list.push({ s:3, t: date });

        if (await DataUpdate(`tbl_lab_booking`, `status = '3', status_list = '${JSON.stringify(appont[0].status_list)}', home_collect_user_id = '${cul}'`, 
            `id = '${appont[0].id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        let ms = `🧑‍🔬 A sample collector has been assigned${ul != "" ? ' :' + ul[0].name : '' }. They will contact you shortly. Appointment ID : # ${appont[0].id}`;
        sendOneNotification(ms, 'customer', appont[0].customer_id, 1);
        sendOneNotification(ms, 'customer', appont[0].customer_id, 2);
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appont[0].id}', '${appont[0].customer_id}', '${appont[0].lab_id}', '${AllFunction.NotificationDate(date)}', '2', '3', '${ms}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        return res.status(200).json({ status: true, message: "Home Collect User Assign Sucessfully.", ul: ul[0].name, title: `${req.lan.ld.Assign} ${req.lan.ld.User}`, 
            ull:ul[0], time: await sDateFormate(date)  });
    } catch (error) {
        console.log(error);
        return res.send({ status: false, message: "Internal Server Error!" });
    }
});

router.post("/web/lab_appoint_ongoing", auth, async(req, res)=>{
    try {
        const {id} = req.body;

        const missingField = ["id"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Something Went Wrong!" });

        const appont = await DataFind(`SELECT id, customer_id, lab_id, status, status_list, home_extra_price FROM tbl_lab_booking WHERE id = '${id}'`); 
        if (appont == '') return res.send({ status: false, message: "Appointment Not Found" });

        appont[0].status_list = typeof appont[0].status_list == "string" ? JSON.parse(appont[0].status_list) : appont[0].status_list;
        if (appont[0].home_extra_price > 0) {
            if (appont[0].status != 3) return res.send({ status: false, message: "Complete Other Steps" });
        } else {
            if (appont[0].status != 2) return res.send({ status: false, message: "Complete Other Steps" });
        }

        let date = new Date().toISOString();
        appont[0].status_list.push({ s:4, t: date });

        if (await DataUpdate(`tbl_lab_booking`, `status = '4', status_list = '${JSON.stringify(appont[0].status_list)}'`, `id = '${appont[0].id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        let ms = `🔄 Your lab appointment is currently in progress. Appointment ID : # ${appont[0].id}`;
        sendOneNotification(ms, 'customer', appont[0].customer_id, 1);
        sendOneNotification(ms, 'customer', appont[0].customer_id, 2);
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appont[0].id}', '${appont[0].customer_id}', '${appont[0].lab_id}', '${AllFunction.NotificationDate(date)}', '2', '4', '${ms}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        return res.status(200).json({ status: true, message: "Appointment Ongoin Successfully.", title: `${req.lan.ld.Ongoing}`, time: await sDateFormate(date)  });
    } catch (error) {
        console.log(error);
        return res.send({ status: false, message: "Internal Server Error!" });
    }
});

router.post("/web/lab_appoint_inprogress", auth, async(req, res)=>{
    try {
        const {id, otp} = req.body;
        
        const missingField = ["id", "otp"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Something Went Wrong!" });

        const appont = await DataFind(`SELECT id, customer_id, lab_id, status, otp, status_list FROM tbl_lab_booking WHERE id = '${id}'`); 
        if (appont == '') return res.send({ status: 1, message: "Appointment Not Found" });
        if (appont[0].status != 4) return res.send({ status: 2, message: "Complete Other Steps" });
        
        appont[0].status_list = typeof appont[0].status_list == "string" ? JSON.parse(appont[0].status_list) : appont[0].status_list;
        
        if (Number(appont[0].otp) != Number(otp)) return res.send({ status: 3, message: "Provide valid otp" });
        let date = new Date().toISOString();
        appont[0].status_list.push({ s: 5, t: date });

        if (await DataUpdate(`tbl_lab_booking`, `status = '5', status_list = '${JSON.stringify(appont[0].status_list)}', otp = ''`, `id = '${appont[0].id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        let ms = `🧪 Your appointment is now in progress. Appointment ID : # ${appont[0].id}`;
        sendOneNotification(ms, 'customer', appont[0].customer_id, 1);
        sendOneNotification(ms, 'customer', appont[0].customer_id, 2);
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appont[0].id}', '${appont[0].customer_id}', '${appont[0].lab_id}', '${AllFunction.NotificationDate(date)}', '2', '5', '${ms}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        return res.status(200).json({ status: 4, message: "Appointment set in progress successfully.", title: `${req.lan.ld.In_Progress}`, time: await sDateFormate(date) });
    } catch (error) {
        console.log(error);
        return res.send({ status: false, message: "Internal Server Error!" });
    }
});

router.post("/web/lab_patient_data", auth, async(req, res)=>{
    try {
        const {id} = req.body;

        const missingField = ["id"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Something Went Wrong!" });

        const appont = await DataFind(`SELECT lb.id, 
                                        JSON_ARRAYAGG(
                                            JSON_OBJECT(
                                                'pid', p.pid, 
                                                'logo', pkg.logo,
                                                'title', pkg.title,
                                                'f', (
                                                    SELECT JSON_ARRAYAGG(
                                                        JSON_OBJECT(
                                                            'c', f.c, 
                                                            'd', f.d, 
                                                            'r', f.r, 
                                                            'id', JSON_OBJECT(
                                                                'id', fm.id, 
                                                                'profile_image', fm.profile_image, 
                                                                'name', fm.name
                                                            )
                                                        )
                                                    )
                                                    FROM JSON_TABLE(p.f, '$[*]' COLUMNS(
                                                        id INT PATH '$.id',
                                                        c VARCHAR(255) PATH '$.c',
                                                        d VARCHAR(255) PATH '$.d',
                                                        r JSON PATH '$.r'
                                                    )) AS f
                                                    JOIN tbl_family_member fm ON f.id = fm.id
                                                )
                                            )
                                        ) AS package_id
                                        FROM tbl_lab_booking lb
                                        JOIN JSON_TABLE(lb.package_id, '$[*]' COLUMNS(
                                            pid INT PATH '$.pid',
                                            f JSON PATH '$.f'
                                        )) AS p
                                        JOIN tbl_lab_package_list pkg ON p.pid = pkg.id
                                        WHERE lb.id = '${id}'
                                        GROUP BY lb.id;`); 

        if (appont == '') return res.send({ status: false, message: "Data Not Found!", appont });

        return res.json({ status: true, message: "Data Load Successfully.", title: `${req.lan.ld.Completed}`, appont });
    } catch (error) {
        console.log(error);
        return res.send({ status: false, message: "Internal Server Error!" });
    }
});

AllFunction.ImageUploadFolderCheck(`./public/uploads/lab_banner`);
const storage4 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/lab_reports");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const lab_reports = multer({storage : storage4});

async function deleteAllReportImage(images) {
    for (const dimg of images) {
        await AllFunction.DeleteImage(dimg);
    }
    return true;
}

router.post('/web/lab_patient_report_upl', lab_reports.array("report[]"), async (req, res) => {
    try {
        const {id, pid, sfid, comment} = req.body;
        
        if (req.files == "") return res.send({ status: false, message: "Please Upload Report!" });
        let images = req.files || [], totimg = [], date = new Date();
        for (const img of images) {
            totimg.push(`uploads/lab_reports/${img.filename}`);
        }
        
        const missingField = ["id", "pid", "sfid"].find(field => !req.body[field]);
        if (missingField) {
            if (totimg.length > 0) await deleteAllReportImage(totimg);
            return res.send({ status: false, message: "Something Went Wrong!" });
        }
        
        const appont = await DataFind(`SELECT id, status, package_id FROM tbl_lab_booking WHERE id = '${id}'`); 

        if (appont == '') {
            if (totimg.length > 0) await deleteAllReportImage(totimg);
            return res.send({ status: false, message: "Appointment not found!" });
        }
        
        if (appont[0].status != 5) {
            if (totimg.length > 0) await deleteAllReportImage(totimg);
            return res.send({ status: false, message: "Complete Other Steps!" });
        }
        appont[0].package_id = typeof appont[0].package_id == "string" ? JSON.parse(appont[0].package_id) : appont[0].package_id; 

        const findfid = appont[0].package_id.find(p => p.pid == pid);
        
        if (findfid) {
            const fid = findfid.f.find(v => v.id == sfid);
            if (fid) { 
                if (fid.r.length > 0) await deleteAllReportImage(fid.r);
                fid.r = totimg; fid.c = comment; fid.d = date.toISOString();
            } else {
                await deleteAllReportImage(totimg);
                return res.send({ status: false, message: "Patient Not Found!" });
            }

        } else {
            await deleteAllReportImage(totimg);
            return res.send({ status: false, message: "Patient Not Found!" });
        }
        
        if (await DataUpdate(`tbl_lab_booking`, `package_id = '${JSON.stringify(appont[0].package_id)}'`, `id = '${appont[0].id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        const imgd = {
            d: date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
            ti:totimg.length, 
            c: comment
        }

        return res.status(200).json({status:true, message: "Patient Report Details Add Successfully.", imgd});
    } catch (error) {
        console.error(error);
        return res.send({ status: false, message: "Internal Server Error!" });
    }
});

router.post("/web/lab_appoint_patientimg", auth, async(req, res)=>{
    try {
        const {id, pid, sfid} = req.body;

        const missingField = ["id", "pid", "sfid"].find(field => !req.body[field]);
        if (missingField) return res.send({ status: false, message: "Something Went Wrong!" });
        
        const appont = await DataFind(`SELECT id, status, package_id FROM tbl_lab_booking WHERE id = '${id}'`); 
        
        if (appont == '') return res.send({ status: false, message: "Appointment not found!" });
        
        appont[0].package_id = typeof appont[0].package_id == "string" ? JSON.parse(appont[0].package_id) : appont[0].package_id;

        const findfid = appont[0].package_id.find(p => p.pid == pid);
        
        if (findfid) {
            const fid = findfid.f.find(v => v.id == sfid);
            if (fid) {
                return res.send({ status: true, message: "Reports Load successfully.", images:fid.r });
            }
        }

        return res.send({ status: false, message: "Data Not Found!" });
    } catch (error) {
        console.log(error);
        return res.send({ status: false, message: "Internal Server Error!" });
    }
});

router.post("/web/lab_appoint_deletelar", auth, async(req, res)=>{
    try {
        const {id, pid, sfid, img} = req.body;

        const missingField = ["id", "pid", "sfid", "img"].find(field => !req.body[field]);
        if (missingField) return res.send({ status: false, message: "Something Went Wrong!" });
        
        const appont = await DataFind(`SELECT id, status, package_id FROM tbl_lab_booking WHERE id = '${id}'`);
        if (appont == '') return res.send({ status: false, message: "Appointment not found" });
        
        appont[0].package_id = typeof appont[0].package_id == "string" ? JSON.parse(appont[0].package_id) : appont[0].package_id; 
        
        const package = appont[0].package_id.find(p => p.pid == pid);
        if (package) {
            const f = package.f.find(v => v.id == sfid);
            if (f) {
                const imgIndex = f.r.indexOf(img);
                if (imgIndex !== -1) {
                    f.r.splice(imgIndex, 1);
                    if (f.r.length == 0) {
                        f.c = ''; f.d = '';
                    }
                    await AllFunction.DeleteImage(img);
                    if (await DataUpdate(`tbl_lab_booking`, `package_id = '${JSON.stringify(appont[0].package_id)}'`, `id = '${appont[0].id}'`, req.hostname, req.protocol) == -1) {
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
                    return res.send({ status: true, message: "Data Delete Successfully.!", l: f.r.length });
                }
            }
        }
        return res.send({ status: false, message: "Data Not Found!!" });
    } catch (error) {
        console.log(error);
        return res.send({ status: false, message: "Internal Server Error!" });
    }
});

router.post("/web/lab_appoint_complete", auth, async(req, res)=>{
    try {
        const {id} = req.body;

        const missingField = ["id"].find(field => !req.body[field]);
        if (missingField) return res.send({ status: false, message: "Something Went Wrong!" });

        const appont = await DataFind(`SELECT lb.id, lb.customer_id, lb.lab_id, lb.status, lb.status_list, lb.tot_price, lb.paid_amount, lb.site_commission, lb.wallet_amount, 
                                        lb.payment_id, COALESCE(ll.wallet, 0) AS lab_wallet, COALESCE(ll.cash_amount, 0) AS lab_cash_amount, COALESCE(ll.tot_payout, 0) AS lab_tot_payout,
                                        COALESCE(cus.pending_ref, '') AS pending_ref, COALESCE(cus.tot_balance, '') AS tot_balance, 0 AS payout_amount, 0 AS cash_amount, 0 AS pay_cash
                                        FROM tbl_lab_booking AS lb
                                        LEFT JOIN tbl_lab_list AS ll ON ll.id = lb.lab_id
                                        LEFT JOIN tbl_customer AS cus ON cus.id = lb.customer_id
                                        WHERE lb.id = '${id}'`);

        if (appont == '') return res.status(200).json({ status: false, message: "Appointment not found"});
        
        if (appont[0].status != 5) return res.status(200).json({ status: false, message: "Complete Other Steps!"});

        let date = new Date().toISOString();
        if (appont[0].payment_id != '16') appont[0].payout_amount = Number((appont[0].tot_price - appont[0].site_commission).toFixed(2));
        else {
            appont[0].pay_cash = Math.max(0, Number((appont[0].site_commission - appont[0].wallet_amount).toFixed(2)));
            appont[0].payout_amount = Math.max(0, Number((appont[0].wallet_amount - appont[0].site_commission).toFixed(2)));
            appont[0].paid_amount = appont[0].tot_price;
        }
        
        if (appont[0].pay_cash > 0) {
            if (await DataInsert(`tbl_lab_cash_adjust`, `appointment_id, lab_id, status, proof_image, amount, date, payment_type, c_status`, 
                `'${appont[0].id}', '${appont[0].lab_id}', '1', '', '${appont[0].pay_cash}', '${date}', '', ''`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
            appont[0].lab_cash_amount = Number((appont[0].lab_cash_amount + appont[0].pay_cash).toFixed(2));
        }
        
        if (appont[0].payout_amount > 0) {

            if (await DataInsert(`tbl_lab_payout_adjust`, `appointment_id, lab_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                `'${appont[0].id}', '${appont[0].lab_id}', '${appont[0].payout_amount}', '${date}', '1', '', '', '', '', '', '', '', ''`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
            appont[0].lab_tot_payout = Number((appont[0].lab_tot_payout + appont[0].payout_amount).toFixed(2));
        }

        appont[0].lab_wallet = Number(( appont[0].lab_wallet + (appont[0].tot_price - appont[0].site_commission)).toFixed(2));

        if (await DataUpdate(`tbl_lab_list`, `wallet = '${appont[0].lab_wallet}', cash_amount = '${appont[0].lab_cash_amount}', tot_payout = '${appont[0].lab_tot_payout}'`,
            `id = '${appont[0].lab_id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        appont[0].status_list = typeof appont[0].status_list == "string" ? JSON.parse(appont[0].status_list) : appont[0].status_list;
        appont[0].status_list.push({ s: 6, t: date });

        if (await DataUpdate(`tbl_lab_booking`, `status = '6', status_list = '${JSON.stringify(appont[0].status_list)}', paid_amount = '${appont[0].tot_price}'`, 
            `id = '${appont[0].id}'`, req.hostname, req.protocol) == -1) {
            
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        if (appont[0].pending_ref != '') {
            await AllFunction.SetReferralAmount(appont[0].pending_ref, appont[0].customer_id, appont[0].tot_balance);
        }

        let ms = `✅ Sample collection is complete. You'll receive your lab report soon. Appointment ID : # ${appont[0].id}`;
        sendOneNotification(ms, 'customer', appont[0].customer_id, 1);
        sendOneNotification(ms, 'customer', appont[0].customer_id, 2);
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appont[0].id}', '${appont[0].customer_id}', '${appont[0].lab_id}', '${AllFunction.NotificationDate(date)}', '2', '6', ${mysql.escape(ms)}`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        return res.status(200).json({ status: true, message: "Appointment Complete Successfully.", title: `${req.lan.ld.Completed}`, time: await sDateFormate(date)});
    } catch (error) {
        console.log(error);
        return res.send({ status: false, message: "Internal Server Error!" });
    }
});



// ============= Gallery ================ //

router.get("/banner", auth, async(req, res)=>{
    try {
        const bannerd = await DataFind(`SELECT * FROM tbl_lab_banner`);
        bannerd.map(val => {
            val.images = val.images.split("&!!");
        })
        
        res.render("lab_banner", {
            auth:req.user, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, general:req.general, bannerd
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_lab_banner", auth, lab_banner.array('image'), async(req, res)=>{
    try {
        if (req.files) {
            const bannerd = await DataFind(`SELECT * FROM tbl_lab_banner`);

            let images = '', imglist = [];
            for (let i = 0; i < req.files.length;) {
                let imgl = req.files[i] ? (images === '' ? "uploads/lab_banner/" + req.files[i].filename : `&!!uploads/lab_banner/${req.files[i].filename}`) : '';
                images += imgl;
                i++;
            }
            
            if (bannerd != '') {
                
                if (bannerd[0].images != '') {
                    images = `${images}&!!${bannerd[0].images}`;
                }

                if (await DataUpdate(`tbl_lab_banner`, `images = '${images}'`, `id = '${bannerd[0].id}'`, req.hostname, req.protocol) == -1) {
                
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
            } else {
                
                if (await DataInsert(`tbl_lab_banner`, `images`, `'${images}'`, req.hostname, req.protocol) == -1) {
                
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
            }
            
            imglist = images.split("&!!");
            
            req.flash('success', 'Lab Banner Add successfully');
            return res.status(200).json({ status: true, imglist, uid:req.user.admin_id, edit: req.lan.ld.Edit, Banner: req.lan.ld.Banner, Image: req.lan.ld.Image });
        }
        return res.status(200).json({ status: false });
    } catch (error) {
        console.log(error);
        return res.status(200).json({ status: false });
    }
});

router.post("/edit_lab_banner", auth, lab_banner.single('image'), async(req, res)=>{
    try {
        const {biuid} = req.body;
        
        if (req.file && biuid) {
            let images = '', nimg = '';
            
            const bannerd = await DataFind(`SELECT * FROM tbl_lab_banner`);
            if (bannerd != '') {
                
                bannerd.map(val => {
                    val.images = val.images.split("&!!");
                })
    
                for (let i = 0; i < bannerd[0].images.length;) {
                    if (biuid == bannerd[0].images[i]) {
                        
                        await AllFunction.DeleteImage(bannerd[0].images[i]);
                        images += images == '' ? `uploads/lab_banner/${req.file.filename}` : `&!!uploads/lab_banner/${req.file.filename}`;
                        nimg = `uploads/lab_banner/${req.file.filename}`
                    }
                    else images += images == '' ? bannerd[0].images[i] : `&!!${bannerd[0].images[i]}`;
                    i++;
                }
                
                if (await DataUpdate(`tbl_lab_banner`, `images = '${images}'`, `id = '${bannerd[0].id}'`, req.hostname, req.protocol) == -1) {
                    
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
                return res.status(200).json({ status: true, biuid: nimg, edit: req.lan.ld.Edit });
            } else return res.status(200).json({ status: false, biuid: nimg, edit: req.lan.ld.Edit });
        }
        return res.status(200).json({ status: false, biuid: nimg, edit: req.lan.ld.Edit });
    } catch (error) {
        console.log(error);
        return res.status(200).json({ status: false });
    }
});

router.post("/delete_lab_banner", auth, async(req, res)=>{
    try {
        const {biuid} = req.body;
        console.log(biuid);
        
        if (biuid) {
            let images = ''
            
            const bannerd = await DataFind(`SELECT * FROM tbl_lab_banner`);
            if (bannerd != '') {
                
                bannerd.map(val => {
                    val.images = val.images.split("&!!") 
                })
    
                for (let i = 0; i < bannerd[0].images.length;) {
                    if (biuid != bannerd[0].images[i]) {
                        images += images == '' ? bannerd[0].images[i] : `&!!${bannerd[0].images[i]}`;
                    } else await AllFunction.DeleteImage(bannerd[0].images[i]);
                    i++;
                }
                if (images != '') {
                    if (await DataUpdate(`tbl_lab_banner`, `images = '${images}'`, `id = '${bannerd[0].id}'`, req.hostname, req.protocol) == -1) {
                        
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
                    return res.status(200).json({ status: true, c: 1 });
                } else {
                    if (await DataDelete(`tbl_lab_banner`, `id = '${bannerd[0].id}'`, req.hostname, req.protocol) == -1) {
        
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
                    return res.status(200).json({ status: true, c: 0, bnf: req.lan.ld.Banner_not_found });
                }
            } else return res.status(200).json({ status: false });
        }
        return res.status(200).json({ status: false });
    } catch (error) {
        console.log(error);
        return res.status(200).json({ status: false });
    }
});




AllFunction.ImageUploadFolderCheck("./public/uploads/lab_category");
const storage1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/lab_category");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const lab_category = multer({storage : storage1});

// ============= Lab category ================ //

router.get("/add_category", auth, async(req, res)=>{
    try {

        res.render("add_lab_category", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_category_data", auth, lab_category.single('image'), async(req, res)=>{
    try {
        const {name, status} = req.body;

        const scname = await DataFind(`SELECT * FROM tbl_lab_category WHERE name = ${mysql.escape(name)}`);
        if (scname != '') {
            if (req.file) await AllFunction.DeleteImage("uploads/lab_category/" + req.file.filename);
            req.flash('errors', `This Name Already Added!`);
            return res.redirect("back");
        }

        const imageUrl = req.file ? "uploads/lab_category/" + req.file.filename : null;
        let esname = mysql.escape(name), statuss = status == "on" ? 1 : 0;

        if (await DataInsert(`tbl_lab_category`, `image, name, status`, `'${imageUrl}', ${esname}, '${statuss}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Lab category Add successfully');
        res.redirect("/lab/category");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})

router.get("/category", auth, async(req, res)=>{
    try {
        const category_list = await DataFind(`SELECT * FROM tbl_lab_category ORDER BY id DESC`);

        res.render("lab_category_list", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, category_list
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/edit_category/:id", auth, async(req, res)=>{
    try {
        const scategory = await DataFind(`SELECT * FROM tbl_lab_category WHERE id = '${req.params.id}'`);
        
        res.render("edit_lab_category", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, scategory:scategory[0]
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_category_data/:id", auth, lab_category.single('image'), async(req, res)=>{
    try {
        const {name, status} = req.body;

        let esname = mysql.escape(name), imageUrl = null, statuss = status == "on" ? 1 : 0;

        const scategory = await DataFind(`SELECT * FROM tbl_lab_category WHERE id = '${req.params.id}'`);

        if (scategory[0].name != name) {
            const scname = await DataFind(`SELECT * FROM tbl_lab_category WHERE name = ${mysql.escape(name)}`);
            if (scname != '') {
                if (req.file) await AllFunction.DeleteImage("uploads/lab_category/" + req.file.filename);
                req.flash('errors', `This Name Already Added!`);
                return res.redirect("back");
            }
        }

        if (req.file) {
            await AllFunction.DeleteImage(scategory[0].image);
            imageUrl = "uploads/lab_category/" + req.file.filename;
        } else imageUrl = scategory[0].image;
        
        if (await DataUpdate(`tbl_lab_category`, `image = '${imageUrl}', name = ${esname}, status = '${statuss}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Lab category Updated successfully');
        res.redirect("/lab/category");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})

router.get("/delete_category/:id", auth, async(req, res)=>{
    try {
        const category = await DataFind(`SELECT * FROM tbl_lab_category WHERE id = '${req.params.id}'`);

        if (category != '') {
            await AllFunction.DeleteImage(category[0].image);
            if (await DataDelete(`tbl_lab_category`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
            req.flash('success', 'Lab category Deleted successfully');
        }

        res.redirect("/lab/category");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})




AllFunction.ImageUploadFolderCheck("./public/uploads/lab");
const storage2 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/lab");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const lab = multer({storage : storage2});

// ============= Lab ================ //

router.get("/add", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);

        res.render("add_lab", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/check_lab_detail", auth, async(req, res)=>{
    try {
        const {email, country_code, phone, lat, lon} = req.body;

        let check_email = true, check_mobileno = true, zonec = true;

        if (lat != '' && lon != '') {
            const zonecec = await DataFind(`SELECT zon.name AS zone_name
                                            FROM tbl_zone AS zon
                                            WHERE zon.status = '1'
                                            AND ST_Contains(
                                                zon.lat_lon_polygon,
                                                ST_SRID(ST_GeomFromText(CONCAT('POINT(', ${Number(lon)}, ' ', ${Number(lat)}, ')')), 4326)
                                            );`);
    
            if (zonecec == '') zonec = false;
        }
        
        if (email != '') {
            const emailExists = await DataFind(`SELECT email FROM tbl_doctor_list WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_lab_list WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_role_permission WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_admin WHERE email = '${email}'`);

            if (emailExists != '') check_email = false;
            else  check_email = true;
        }

        if (country_code != '' && phone != '') {
            const phoneExists = await DataFind(`SELECT phone FROM tbl_doctor_list WHERE country_code = '${country_code}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_lab_list WHERE country_code = '${country_code}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_doctor_receptionist WHERE country_code = '${country_code}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_role_permission WHERE country_code = '${country_code}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_admin WHERE country_code = '${country_code}' AND phone = '${phone}'`);

            if (phoneExists != '') check_mobileno = false;
            else  check_mobileno = true;
        }

        res.send({check_email, check_mobileno, zonec});
    } catch (error) {
        console.log(error);
        res.send({check_email: 2, check_mobileno: 2, zonec: 2});
    }
});

router.post("/add_lab_data", auth, lab.single('logo'), async(req, res)=>{
    try {
        const {name, email, country_code, phone, password, lab_code, license_number, commission, latitude, longitude, description, address, status} = req.body;

        const imageUrl = req.file ? "uploads/lab/" + req.file.filename : null;
        let esname = mysql.escape(name), edesc = mysql.escape(description), eaddress = mysql.escape(address), hash = await bcrypt.hash(password, 10);
        
        let vs = 0;
        if (status != "on") {
            const gs = await DataFind(`SELECT lab_auto_approve FROM tbl_general_settings`);
            if (gs != '') {
                if (gs[0].lab_auto_approve > 0 && !isNaN(gs[0].lab_auto_approve)) {
                    vs = gs[0].lab_auto_approve;
                }
            }
        } else vs = 1;

        if (await DataInsert(`tbl_lab_list`, `logo, name, email, country_code, phone, password, commission, lab_code, status, description, license_number, address, latitude, longitude,
            wallet, cash_amount, success_cash, tot_payout, success_payout, join_date`, 
            `'${imageUrl}', ${esname}, '${email}', '${country_code}', '${phone}', '${hash}', '${commission}', '${lab_code}', '${vs}', ${edesc}, '${license_number}', ${eaddress}, 
            '${latitude}', '${longitude}', '0', '0', '0', '0', '0', '${new Date().toISOString().split("T")[0]}'`, req.hostname, req.protocol) == -1) {

            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Lab category Add successfully');
        res.redirect("/lab/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})

router.get("/list", auth, async(req, res)=>{
    try {
        const lab_list = await DataFind(`SELECT id, logo, name, email, country_code, phone, status FROM tbl_lab_list ORDER BY id DESC`);

        res.render("list_lab", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, lab_list
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/edit/:id", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        const lab = await DataFind(`SELECT * FROM tbl_lab_list WHERE id = '${req.params.id}'`);

        if (lab == '') {
            req.flash('errors', `Lab not found!`);
            return res.redirect("back");
        }

        res.render("edit_lab", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode, lab:lab[0]
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_lab_data/:id", auth, lab.single('logo'), async(req, res)=>{
    try {
        const {name, email, country_code, phone, password, lab_code, license_number, commission, latitude, longitude, description, address, status} = req.body;

        const lab = await DataFind(`SELECT id, logo, password FROM tbl_lab_list WHERE id = '${req.params.id}'`);

        if (lab != '') {
            let imageUrl = null;
            if (req.file) {
                await AllFunction.DeleteImage(lab[0].logo);
                imageUrl = "uploads/lab/" + req.file.filename;
            } else imageUrl = lab[0].logo;
            
            let esname = mysql.escape(name), edesc = mysql.escape(description), eaddress = mysql.escape(address), statuss = status == "on" ? 1 : 0, 
                hash = password ? await bcrypt.hash(password, 10) : lab[0].password;

            if (await DataUpdate(`tbl_lab_list`, `logo = '${imageUrl}', name = ${esname}, email = '${email}', country_code = '${country_code}', phone = '${phone}', 
                password = '${hash}', commission = '${commission}', lab_code = '${lab_code}', status = '${statuss}', description = ${edesc}, license_number = '${license_number}', 
                address = ${eaddress}, latitude = '${latitude}', longitude = '${longitude}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
    
            req.flash('success', 'Lab category Updated successfully');
        }
        res.redirect("/lab/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        const lab = await DataFind(`SELECT id, logo FROM tbl_lab_list WHERE id = '${req.params.id}'`);

        if (lab != '') {
            await AllFunction.DeleteImage(lab[0].logo);
            if (await DataDelete(`tbl_lab_list`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
            req.flash('success', 'Lab category Deleted successfully');
        }

        res.redirect("/lab/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})





AllFunction.ImageUploadFolderCheck("./public/uploads/lab_package");
const storage3 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/lab_package");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const lab_package = multer({storage : storage3});

// ============= Package ================ //

router.get("/add_package", auth, async(req, res)=>{
    try {
        const category = await DataFind(`SELECT * FROM tbl_lab_category ORDER BY id DESC`);

        res.render("add_lab_package", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, category
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_lab_package_data", auth, lab_package.single('logo'), async(req, res)=>{
    try {
        const {title, subtitle, description, home_extra_price, fasting_require, test_report_time, sample_type, category_list, package_type, status, package_name, package_price} = req.body;

        const imageUrl = req.file ? "uploads/lab_package/" + req.file.filename : null;
        let etitle = mysql.escape(title), esubtitle = mysql.escape(subtitle), edeacri = mysql.escape(description), statuss = status == "on" ? 1 : 0;

        let sty = [], cl = [], pn = [], pnp = [];
        if (typeof sample_type == "string") sty = [sample_type];
        else sty = [...sample_type];

        if (typeof category_list == "string") cl = [Number(category_list)];
        else cl = [...category_list].map(val => Number(val));

        if (typeof package_name == "string") {
            pn = [package_name];
            pnp = [Number(package_price)];
        } else {
            pn = [...package_name];
            pnp = [...package_price].map(val => Number(val));
        }

        if (await DataInsert(`tbl_lab_package_list`, `lab_id, logo, title, subtitle, description, home_extra_price, fasting_require, test_report_time, sample_type, category_list, package_type, 
            status, package_name, package_price`, 
            `'${req.user.admin_id}', '${imageUrl}', ${etitle}, ${esubtitle}, ${edeacri}, '${home_extra_price}', '${fasting_require}', '${test_report_time}', '${JSON.stringify(sty)}', 
            '${JSON.stringify(cl)}', '${package_type}', '${statuss}', '${JSON.stringify(pn)}', '${JSON.stringify(pnp)}'`, req.hostname, req.protocol) == -1) {

            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Package Add successfully');
        res.redirect("/lab/package_list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})

router.get("/package_list", auth, async(req, res)=>{
    try {
        const lab_package_list = await DataFind(`SELECT id, logo, title, status FROM tbl_lab_package_list WHERE lab_id = '${req.user.admin_id}' ORDER BY id DESC`);

        res.render("list_lab_package", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, lab_package_list
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/edit_package/:id", auth, async(req, res)=>{
    try {
        const category = await DataFind(`SELECT * FROM tbl_lab_category ORDER BY id DESC`);
        const labp = await DataFind(`SELECT * FROM tbl_lab_package_list WHERE id = '${req.params.id}'`);

        if (labp == '') {
            req.flash('errors', `Lab not found!`);
            return res.redirect("back");
        }

        labp[0].sample_type = typeof labp[0].sample_type == "string" ? labp[0].sample_type.split(",") : labp[0].sample_type;
        labp[0].category_list = typeof labp[0].category_list == "string" ? labp[0].category_list.split(",") : labp[0].category_list;
        labp[0].package_name = typeof labp[0].package_name == "string" ? labp[0].package_name.split(",") : labp[0].package_name;
        labp[0].package_price = typeof labp[0].package_price == "string" ? labp[0].package_price.split(",") : labp[0].package_price;

        res.render("edit_lab_package", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, category, labp:labp[0]
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_lab_package_data/:id", auth, lab_package.single('logo'), async(req, res)=>{
    try {
        const {title, subtitle, description, home_extra_price, fasting_require, test_report_time, sample_type, category_list, package_type, status, package_name, package_price} = req.body;

        const lab = await DataFind(`SELECT id, logo FROM tbl_lab_package_list WHERE id = '${req.params.id}'`);

        if (lab != '') {
            let imageUrl = null, etitle = mysql.escape(title), esubtitle = mysql.escape(subtitle), edeacri = mysql.escape(description), statuss = status == "on" ? 1 : 0;
            if (req.file) {
                await AllFunction.DeleteImage(lab[0].logo);
                imageUrl = req.file ? "uploads/lab_package/" + req.file.filename : null;
            } else imageUrl = lab[0].logo;
    
            let sty = [], cl = [], pn = [], pnp = [];
            if (typeof sample_type == "string") sty = [sample_type];
            else sty = [...sample_type];
    
            if (typeof category_list == "string") cl = [Number(category_list)];
            else cl = [...category_list].map(val => Number(val));
            
            if (typeof package_name == "string") {
                pn = [package_name];
                pnp = [Number(package_price)];
            } else {
                pn = [...package_name];
                pnp = [...package_price].map(val => Number(val));
            }

            if (await DataUpdate(`tbl_lab_package_list`, `logo = '${imageUrl}', title = ${etitle}, subtitle = ${esubtitle}, description = ${edeacri}, home_extra_price = '${home_extra_price}', 
                fasting_require = '${fasting_require}', test_report_time = '${test_report_time}', sample_type = '${JSON.stringify(sty)}', category_list = '${JSON.stringify(cl)}', 
                package_type = '${package_type}', status = '${statuss}', package_name = '${JSON.stringify(pn)}', package_price = '${JSON.stringify(pnp)}'`, `id = '${lab[0].id}'`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
            req.flash('success', 'Package Updated successfully');
        } else {
            if (req.file) await AllFunction.DeleteImage("uploads/lab_package/" + req.file.filename)
        }
        
        res.redirect("/lab/package_list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})

router.get("/delete_package/:id", auth, async(req, res)=>{
    try {
        const lab = await DataFind(`SELECT id, logo FROM tbl_lab_package_list WHERE id = '${req.params.id}'`);

        if (lab != '') {
            await AllFunction.DeleteImage(lab[0].logo);
            if (await DataDelete(`tbl_lab_package_list`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
            req.flash('success', 'Package Deleted successfully');
        }

        res.redirect("/lab/package_list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})





// ============= Sitter Coupon ================ //

router.get("/coupon", auth, async(req, res)=>{
    try {
        const coupon_list = await DataFind(`SELECT * FROM tbl_lab_coupon WHERE lab_id = '${req.user.admin_id}' ORDER BY id DESC`);

        res.render("lab_coupon", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, coupon_list
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_coupon", auth, async(req, res)=>{
    try {
        const {title, sub_title, code, start_date, end_date, min_amount, discount_amount} = req.body;
        
        if (await DataInsert(`tbl_lab_coupon`, `lab_id, title, sub_title, code, start_date, end_date, min_amount, discount_amount`,
            `'${req.user.admin_id}', '${title}', '${sub_title}', '${code}', '${start_date}', '${end_date}', '${min_amount}', '${discount_amount}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Coupon Add successfully');
        res.redirect("/lab/coupon");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_coupon/:id", auth, async(req, res)=>{
    try {
        const {title, sub_title, code, start_date, end_date, min_amount, discount_amount} = req.body;

        if (await DataUpdate(`tbl_lab_coupon`, `title = '${title}', sub_title = '${sub_title}', code = '${code}', start_date = '${start_date}', end_date = '${end_date}', 
            min_amount = '${min_amount}', discount_amount = '${discount_amount}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Coupon Updated successfully');
        res.redirect("/lab/coupon");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete_coupon/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_lab_coupon`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Coupon Deleted successfully');
        res.redirect("/lab/coupon");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});





// ============= Home Collect User List ================ //

router.get("/add_user", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        const user_list = await DataFind(`SELECT * FROM tbl_lab_home_collect_user WHERE lab_id = '${req.user.admin_id}' ORDER BY id DESC`);

        res.render("add_lab_home_collect", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode, user_list
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/check_collect_data", auth, async(req, res)=>{
    try {
        const {email, country_code, phone} = req.body;
        
        let check_email = true, check_mobileno = true;
        
        if (email != '') {
            const luser_email = await DataFind(`SELECT * FROM tbl_lab_home_collect_user WHERE email = '${email}'`);
            
            if (luser_email != '') check_email = false;
            else check_email = true;
        }

        if (country_code != '' && phone != '') {
            const luser_number = await DataFind(`SELECT * FROM tbl_lab_home_collect_user WHERE country_code = '${country_code}' AND phone = '${phone}'`);
            
            if (luser_number != '') check_mobileno = false;
            else check_mobileno = true;
        }

        res.send({check_email, check_mobileno});
    } catch (error) {
        console.log(error);
        res.send({check_email: 2, check_mobileno: 2});
    }
});

router.post("/add_lab_collect_data", auth, async(req, res)=>{
    try {
        const {name, email, country_code, phone, status} = req.body;
        
        let esname = mysql.escape(name), statuss = status == "on" ? 1 : 0;

        if (await DataInsert(`tbl_lab_home_collect_user`, `lab_id, name, email, country_code, phone, status`, `'${req.user.admin_id}', ${esname}, '${email}', '${country_code}', '${phone}', 
            '${statuss}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Home Collect User Add successfully');
        res.redirect("/lab/user_list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/user_list", auth, async(req, res)=>{
    try {
        const user_list = await DataFind(`SELECT * FROM tbl_lab_home_collect_user WHERE lab_id = '${req.user.admin_id}' ORDER BY id DESC`);

        res.render("list_lab_home_collect", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, user_list
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/edit_user/:id", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        const user = await DataFind(`SELECT * FROM tbl_lab_home_collect_user WHERE id = '${req.params.id}' ORDER BY id DESC`);
        if (user == '') {
            req.flash('errors', `User not found!`);
            res.redirect("back")
        }

        res.render("edit_lab_home_collect", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode, user: user[0]
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_lab_collect_data/:id", auth, async(req, res)=>{
    try {
        const {name, email, country_code, phone, status} = req.body;
        
        let esname = mysql.escape(name), statuss = status == "on" ? 1 : 0;

        if (await DataUpdate(`tbl_lab_home_collect_user`, `name = ${esname}, email = '${email}', country_code = '${country_code}', phone = '${phone}', status = '${statuss}'`, 
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Home Collect User Edit successfully');
        res.redirect("/lab/user_list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete_user/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_lab_home_collect_user`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Home Collect User Delete successfully');
        res.redirect("/lab/user_list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Lab Wallet ================ //

router.get("/wallet", auth, async(req, res)=>{
    try {
        const lab = await DataFind(`SELECT dl.wallet, dl.tot_payout, dl.cash_amount, dl.success_payout, COALESCE(gs.lab_min_withdraw, "0") AS lab_min_withdraw
                                        FROM tbl_lab_list AS dl
                                        LEFT JOIN tbl_general_settings AS gs ON 1 = 1
                                        WHERE dl.id = '${req.user.admin_id}'`);
        if(lab == '') {
            req.flash('errors', `Data not found!`);
            return res.redirect("back");
        }

        const app = await DataFind(`SELECT bookap.id, (bookap.tot_price - bookap.site_commission) AS tot_earning, bookap.tot_price, bookap.site_commission, bookap.wallet_amount, 
                                    0 AS online_amount, 0 AS cash_amount, bookap.book_date, bookap.book_time, 
                                    CASE WHEN bookap.status = "6" THEN 'completed' WHEN bookap.status = "7" THEN 'canceled' END AS status_type,
                                    COALESCE(cus.name, '') AS cus_name, COALESCE(pd.name, '') AS p_name, bookap.wallet_amount AS wallet_status
                                    FROM tbl_lab_booking AS bookap
                                    LEFT JOIN tbl_customer AS cus ON cus.id = bookap.customer_id
                                    LEFT JOIN tbl_payment_detail AS pd ON pd.id = bookap.payment_id
                                    WHERE bookap.lab_id = '${req.user.admin_id}' AND bookap.status IN (6,7) ORDER BY bookap.id DESC;`);
        
        const all_data = [];
        app.forEach(item => {
            item.date = new Date(`${item.book_date.split("-").reverse()} ${item.book_time}`).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    
            if (item.p_name != 'Cash') item.online_amount = Number((item.tot_price - item.wallet_amount).toFixed(2));
            else item.online_amount = 0;

            if (item.p_name == 'Cash') item.cash_amount = Number((item.tot_price - item.wallet_amount).toFixed(2));
            
            item.wallet_status = item.wallet_status > 0 ? 1 : 0;

            delete item.appointment_date; delete item.appointment_time;

            all_data.push(item);
        });

        res.render('lab_wallet', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, all_data, lab
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/lab_withd_data", auth, async(req, res)=>{
    try {
        const lab = await DataFind(`SELECT dl.wallet, dl.tot_payout, dl.cash_amount, dl.success_payout, COALESCE(gs.lab_min_withdraw, "0") AS lab_min_withdraw
                                        FROM tbl_lab_list AS dl
                                        LEFT JOIN tbl_general_settings AS gs ON 1 = 1
                                        WHERE dl.id = '${req.user.admin_id}'`);
        
        res.send({ status: lab != '' ? true : false, lab });
    } catch (error) {
        console.log(error);
        res.send({ status: false });
    }
});

router.post("/web_wallet_withdraw", auth, async(req, res)=>{
    try {
        const { Withdraw_amount, payment_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type } = req.body;

        const doctor = await DataFind(`SELECT id, tot_payout, success_payout FROM tbl_lab_list WHERE id = '${req.user.admin_id}'`);
        if (doctor == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User Not Found!'});

        const general_setting = await DataFind(`SELECT lab_min_withdraw FROM tbl_general_settings`);
        if (general_setting == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data Not Found!'});
        
        if (doctor[0].tot_payout >= general_setting[0].lab_min_withdraw) {
            const date = new Date().toISOString();
            
            if (parseFloat(Withdraw_amount) >= parseFloat(general_setting[0].lab_min_withdraw) && parseFloat(Withdraw_amount) <= doctor[0].tot_payout) {
                console.log(doctor[0].tot_payout);
                let check = 0, wid;
                if (payment_type == "UPI") {
                    const missingField = await AllFunction.BodyDataCheck(["upi_id"], req.body);
                    if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

                    check = 1;

                    wid = await DataInsert(`tbl_lab_payout_adjust`, `appointment_id, lab_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${req.user.admin_id}', '${Withdraw_amount}', '${date}', '2', '0', '', '1', '${upi_id}', '', '', '', ''`, req.hostname, req.protocol);
                    
                } else if (payment_type == "Paypal") {
                    const missingField = await AllFunction.BodyDataCheck(["paypal_id"], req.body);
                    if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

                    check = 1;

                    wid = await DataInsert(`tbl_lab_payout_adjust`, `appointment_id, lab_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${req.user.admin_id}', '${Withdraw_amount}', '${date}', '2', '0', '', '2', '', '${paypal_id}', '', '', ''`, req.hostname, req.protocol);
                    
                } else if (payment_type == "BANK Transfer") {
                    const missingField = await AllFunction.BodyDataCheck(["bank_no", "bank_ifsc", "bank_type"], req.body);
                    if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

                    check = 1;

                    wid = await DataInsert(`tbl_lab_payout_adjust`, `appointment_id, lab_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${req.user.admin_id}', '${Withdraw_amount}', '${date}', '2', '0', '', '3', '', '', '${bank_no}', '${bank_ifsc}', '${bank_type}'`, req.hostname, req.protocol);

                }
                if (wid == -1) {
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }

                if (check == "1") {
                    let total = parseFloat((parseFloat(doctor[0].tot_payout) - parseFloat(Withdraw_amount)).toFixed(2));
                    let success_payout = parseFloat((parseFloat(doctor[0].success_payout) + parseFloat(Withdraw_amount)).toFixed(2));

                    if (await DataUpdate(`tbl_lab_list`, `tot_payout = '${total}', success_payout = '${success_payout}'`, `id = '${doctor[0].id}'`, req.hostname, req.protocol) == -1) {
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
                    
                }

                req.flash('success', 'Wallet Withdraw Request add successfully');
                return res.redirect("/lab/wallet"); 
            }

            if (parseFloat(Withdraw_amount) < parseFloat(general_setting[0].lab_min_withdraw)) req.flash('errors', `Minimum Withdrawal Amount ${parseFloat(general_setting[0].lab_min_withdraw)}`);
            if (parseFloat(Withdraw_amount) > parseFloat(doctor[0].tot_payout)) req.flash('errors', `Maximum Withdrawal Amount ${parseFloat(doctor[0].tot_payout)}`);
            return res.redirect("/lab/wallet");
            
        } 
        req.flash('errors', `Minimum Withdrawal Amount ${parseFloat(general_setting[0].lab_min_withdraw)}`);
        res.redirect("/lab/wallet");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

// ============= Sitter Wallet ================ //

router.get("/cash_management", auth, async(req, res)=>{
    try {
        const lab = await DataFind(`SELECT cash_amount, success_cash FROM tbl_lab_list WHERE id = '${req.user.admin_id}'`);
        if (lab == '') {
            req.flash('errors', `User not found!`);
            return res.redirect("back");
        }
        
        const cash_list = await DataFind(`SELECT * FROM tbl_lab_cash_adjust WHERE lab_id = '${req.user.admin_id}' AND status = '2' ORDER BY id DESC`);
                          
        cash_list.map(a => {
            a.date = new Date(a.date).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        });
        
        res.render('lab_cash_adjust', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, cash: lab[0], cash_list
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/lab_cash_wbalance", auth, async(req, res)=>{
    try {
        const lab = await DataFind(`SELECT cash_amount, success_cash FROM tbl_lab_list WHERE id = '${req.user.admin_id}'`);
        
        res.send({ status: lab != '' ? true : false, lab });
    } catch (error) {
        console.log(error);
        res.send({ status: false });
    }
});



const storage5 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/lab_cash_proof");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const cash_proof = multer({storage : storage5});

router.post("/withdraw_cash_amount", auth, cash_proof.single("cash_proof_img"), async(req, res)=>{
    try {
        const {cash_amount, payment_type} = req.body;
        
        if (!req.file) req.flash('errors', 'Please upload proof!');

        const lab = await DataFind(`SELECT id, cash_amount, success_cash FROM tbl_lab_list WHERE id = '${req.user.admin_id}'`);
        
        if(lab == '') {
            if (req.file) await AllFunction.DeleteImage("uploads/lab_cash_proof/" + req.file.filename);
            req.flash('errors', 'User not found!');
            return res.redirect("back");
        }

        if (lab[0].cash_amount >= cash_amount) {
            const imageUrl = req.file ? "uploads/lab_cash_proof/" + req.file.filename : null;

            if (await DataInsert(`tbl_lab_cash_adjust`, `appointment_id, lab_id, status, proof_image, amount, date, payment_type, c_status`, 
                `'', '${req.user.admin_id}', '2', '${imageUrl}', '${cash_amount}', '${new Date().toISOString()}', '${payment_type}', '1'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            let cash_total = parseFloat((parseFloat(lab[0].cash_amount) - parseFloat(cash_amount)).toFixed(2));
            let success_cash = parseFloat((parseFloat(lab[0].success_cash) + parseFloat(cash_amount)).toFixed(2));
            
            if (await DataUpdate(`tbl_lab_list`, `cash_amount = '${cash_total}', success_cash = '${success_cash}'`, `id = '${lab[0].id}'`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            req.flash('success', 'Cash withdraw successful');
        }

        res.redirect("/lab/cash_management");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/cash_history", auth, async(req, res)=>{
    try {
        const doctor = await DataFind(`SELECT cash_amount, success_cash FROM tbl_lab_list WHERE id = '${req.user.admin_id}'`);
        if(doctor == '') {
            req.flash('errors', `User not found!`);
            return res.redirect("back");
        }

        const app = await DataFind(`SELECT bookap.id, (bookap.tot_price - bookap.site_commission) AS tot_earning, bookap.tot_price, bookap.site_commission, bookap.wallet_amount, 
                                    0 AS online_amount, 0 AS cash_amount, dca.amount AS add_cash, bookap.book_date, bookap.book_time,
                                    COALESCE(cus.name, '') AS cus_name, COALESCE(pd.name, '') AS p_name, bookap.wallet_amount AS wallet_status
                                    FROM tbl_lab_cash_adjust AS dca
                                    JOIN tbl_lab_booking AS bookap ON bookap.id = dca.appointment_id
                                    LEFT JOIN tbl_customer AS cus ON cus.id = bookap.customer_id
                                    LEFT JOIN tbl_payment_detail AS pd ON pd.id = bookap.payment_id
                                    WHERE dca.lab_id = '${req.user.admin_id}' ORDER BY dca.id DESC;`);
        
        let all_data = [], tot_with_amount = 0;
        app.forEach(item => {
            item.date = new Date(`${item.book_date} ${item.book_time}`).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });

            if (item.p_name != 'Cash') item.online_amount = Number((item.tot_price - item.wallet_amount).toFixed(2));
            else item.online_amount = 0;

            if (item.p_name == 'Cash') item.cash_amount = Number((item.tot_price - item.wallet_amount).toFixed(2));
            
            item.wallet_status = item.wallet_status > 0 ? 1 : 0;

            tot_with_amount += item.cash_amount

            delete item.book_date; delete item.book_time;

            all_data.push(item);
        });
        
        res.render('lab_cash_history', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, doctor, all_data, tot_with_amount
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/payout_history", auth, async(req, res)=>{
    try {
        const lab = await DataFind(`SELECT tot_payout, success_payout FROM tbl_lab_list WHERE id = '${req.user.admin_id}'`);
        if(lab == '') {
            req.flash('errors', `User not found!`);
            return res.redirect("back");
        }

        const app = await DataFind(`SELECT id, appointment_id, lab_id, amount, date, status, p_status, image, p_type
                                    FROM tbl_lab_payout_adjust WHERE lab_id = '${req.user.admin_id}' ORDER BY id DESC`);
             
        app.map(val => {
            val.date = new Date(val.date).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
            delete val.appointment_time;
        });

        res.render('lab_payout_history', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, lab, payout_list: app
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});





module.exports = router;