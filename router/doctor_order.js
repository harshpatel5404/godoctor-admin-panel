/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
let mysql = require('mysql');
const sendOneNotification = require("../middleware/send");
const ChatFunction = require("../route_function/chat_function");
const AllFunction = require("../route_function/function");
const { DataFind, DataInsert, DataUpdate } = require("../middleware/database_query");



router.get("/list", auth, async(req, res)=>{
    try {
        const al = await DataFind(`SELECT bap.id, COALESCE(cus.id, 0) AS cid, 
                                    bap.appointment_date, bap.appointment_time, bap.show_type, bap.status, bap.tot_price, bap.wallet_amount, bap.paid_amount, bap.show_type,
                                    COALESCE(cus.image) AS cus_image, COALESCE(cus.name) AS name, COALESCE(pd.name, '') AS payment_name,
                                    JSON_OBJECT(
                                        's', CASE
                                            WHEN bap.status = '1' THEN '${req.lan.ld.Pending}'
                                            WHEN bap.status = '2' THEN '${req.lan.ld.Service} ${req.lan.ld.Start}'
                                            WHEN bap.status = '3' THEN '${req.lan.ld.Service} ${req.lan.ld.End}'
                                            WHEN bap.status = '4' THEN '${req.lan.ld.Completed}'
                                            WHEN bap.status = '5' THEN '${req.lan.ld.Canceled}'
                                            ELSE ''
                                        END,
                                        'b', CASE
                                            WHEN bap.status = '1' THEN 'btn-warning'
                                            WHEN bap.status = '2' THEN 'btn-secondary'
                                            WHEN bap.status = '3' THEN 'btn-primary'
                                            WHEN bap.status = '4' THEN 'btn-success'
                                            WHEN bap.status = '5' THEN 'btn-danger'
                                            ELSE ''
                                        END
                                    ) AS status_type
                                    FROM tbl_booked_appointment AS bap
                                    LEFT JOIN tbl_customer AS cus ON cus.id = bap.customer_id
                                    LEFT JOIN tbl_payment_detail AS pd ON pd.id = bap.payment_id
                                    ${req.user.admin_role != 1 ? `WHERE bap.doctor_id = '${req.user.admin_id}'` : `` }
                                    ORDER BY bap.id DESC;`);

        res.render("doctor_booking_list", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, al
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

function ConvertTimeFormate(date) {
    return date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
}

router.get("/details/:id", auth, async(req, res)=>{
    try {
        const appoint = await DataFind(`SELECT boap.id, boap.customer_id, boap.doctor_id, boap.hospital_id, boap.department_id, boap.sub_depar_id, boap.status, boap.book_date, 
                                        boap.appointment_date, boap.appointment_time, boap.date_type, boap.family_mem_id, boap.show_type, boap.show_type_price, boap.tot_price,
                                        boap.paid_amount, boap.additional_price, boap.coupon_id, boap.coupon_amount, boap.doctor_commission, boap.site_commisiion, 
                                        boap.wallet_amount, 0 AS online_amount, 0 AS cash_amount, COALESCE(pd.name, '') AS payment_name, boap.additional_note, boap.treatment_time,
                                        boap.vitals_physical, boap.drugs_prescription, boap.diagnosis_test,
                                        COALESCE(cl.title, '') AS cancel_title, COALESCE(boap.cancel_reason, '') AS cancel_reason, boap.transactionId,
                                        JSON_OBJECT(
                                            's', CASE
                                                WHEN boap.status = '1' THEN '${req.lan.ld.Pending}'
                                                WHEN boap.status = '2' THEN '${req.lan.ld.Service} ${req.lan.ld.Start}'
                                                WHEN boap.status = '3' THEN '${req.lan.ld.Service} ${req.lan.ld.End}'
                                                WHEN boap.status = '4' THEN '${req.lan.ld.Completed}'
                                                WHEN boap.status = '5' THEN '${req.lan.ld.Canceled}'
                                                ELSE ''
                                            END,
                                            'b', CASE
                                                WHEN boap.status = '1' THEN 'btn-warning'
                                                WHEN boap.status = '2' THEN 'btn-secondary'
                                                WHEN boap.status = '3' THEN 'btn-primary'
                                                WHEN boap.status = '4' THEN 'btn-success'
                                                WHEN boap.status = '5' THEN 'btn-danger'
                                                ELSE ''
                                            END
                                        ) AS status_type
                                        FROM tbl_booked_appointment AS boap
                                        LEFT JOIN tbl_payment_detail AS pd ON pd.id = boap.payment_id
                                        LEFT JOIN tbl_appointment_cancel_list AS cl ON cl.id = boap.cancel_id AND boap.cancel_id != ''
                                        WHERE boap.id = '${req.params.id}'
                                        ${req.user.admin_role != 1 ? ` AND boap.doctor_id = '${req.user.admin_id}'` : `` }`);

        if (appoint == '') {
            req.flash('errors', `Appointment not Found!`);
            return res.redirect("back");
        }

        appoint[0].vitals_physical = typeof appoint[0].vitals_physical == "string" ? JSON.parse(appoint[0].vitals_physical) : appoint[0].vitals_physical;
        appoint[0].drugs_prescription = typeof appoint[0].drugs_prescription == "string" ? JSON.parse(appoint[0].drugs_prescription) : appoint[0].drugs_prescription;
        appoint[0].diagnosis_test = typeof appoint[0].diagnosis_test == "string" ? JSON.parse(appoint[0].diagnosis_test) : appoint[0].diagnosis_test;
        appoint[0].treatment_time = typeof appoint[0].treatment_time == "string" ? JSON.parse(appoint[0].treatment_time) : appoint[0].treatment_time;
        
        const fm = await DataFind(`SELECT id, profile_image, name FROM tbl_family_member WHERE id IN (${appoint[0].family_mem_id})`);

        const vp = appoint[0].vitals_physical.find(vpv => vpv[fm[0].id]), dp = appoint[0].drugs_prescription.find(dpv => dpv[fm[0].id]), dt = appoint[0].diagnosis_test.find(dtv => dtv[fm[0].id]);

        const date = new Date(appoint[0].book_date);
        const formattedDate = ConvertTimeFormate(date);
        
        appoint[0].book_date = formattedDate;

        let treatt = appoint[0].treatment_time;
        appoint[0].treatment_time.start_time = treatt?.start_time ? ConvertTimeFormate(new Date(treatt.start_time)) : '';
        appoint[0].treatment_time.end_time = treatt?.end_time ? ConvertTimeFormate(new Date(treatt.end_time)) : '';
            
        if (appoint[0].payment_name != 'Cash') appoint[0].online_amount = Number((appoint[0].tot_price - appoint[0].wallet_amount).toFixed(2));
        else appoint[0].online_amount = 0;

        if (appoint[0].payment_name == 'Cash') appoint[0].cash_amount = Number((appoint[0].tot_price - appoint[0].paid_amount).toFixed(2));

        let timecount = { hour: 0, minute: 0, second: 0 };

        if (appoint[0].status == "1") {
            let timecount = await AllFunction.TwoTimeDiference(new Date(`${appoint[0].appointment_date} ${appoint[0].appointment_time}`).toISOString(), new Date().toISOString());
            
            if (timecount.hour < 0 || timecount.minute < 0 || timecount.second < 0) appoint[0].timecount = 0
            else appoint[0].timecount = Number(timecount.hour) * 60 * 60 + Number(timecount.minute) * 60 + Number(timecount.second);
        } else appoint[0].timecount = 0;
        
        const customer = await DataFind(`SELECT id, image, name, email, country_code, phone
                                        FROM tbl_customer
                                        WHERE id = '${appoint[0].customer_id}' AND status = '1'`);

        const sebservice = await DataFind(`SELECT dhd.id, COALESCE(dl.image) AS depart_image, COALESCE(dl.name, '') AS department_name, dhd.sub_title, dhd.image, dhd.client_visit_price, 
                                            dhd.video_consult_price, dhd.show_type
                                            FROM tbl_doctor_hos_depart_list AS dhd
                                            LEFT JOIN tbl_department_list AS dl ON dl.id = dhd.department_id
                                            WHERE dhd.id = '${appoint[0].sub_depar_id}' AND dhd.sub_title != '' ORDER BY id DESC`);
        
        const hospital = await DataFind(`SELECT id, image, name, email, country_code, phone, address FROM tbl_hospital_list WHERE id = '${appoint[0].hospital_id}' AND status = '1';`);
        
        if (hospital != '') hospital[0].image = hospital[0].image.split("&!!")[0];
        
        const cr = await DataFind(`SELECT id, title FROM tbl_appointment_cancel_list WHERE status = '1' ORDER BY id DESC;`);

        const medicine = await DataFind(`SELECT * FROM tbl_doctor_medicine WHERE doctor_id = '${req.user.admin_id}' ORDER BY id DESC`);

        res.render("doctor_booking_detail", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, appoint: appoint[0], medicine, timecount,
            sebservice: sebservice[0], hospital: hospital[0], customer: customer[0], family_member:fm, cr, vp: vp ? 1 : 0, dp: dp ? 1 : 0, dt: dt ? 1 : 0
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post('/cancel_appointment', auth, async (req, res) => {
    try {
        const {id, cul, oth} = req.body;
        
        const missingField = ["id", "cul"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Data Not Found" });

        const appoint = await DataFind(`SELECT id, customer_id, doctor_id, status, paid_amount, tot_price, site_commisiion, appointment_date, appointment_time, hospital_id, date_type 
                                        FROM tbl_booked_appointment 
                                        WHERE id = '${id}' AND doctor_id = '${req.user.admin_id}';`);
        if (appoint == '') return res.send({ status:false, message: "Appointment Not Found" });
        if (appoint[0].status != 1) return res.send({ status:false, message: await AllFunction.AppointmentStatus(appoint[0].status) });
        
        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${appoint[0].customer_id}'`);
        if (customer == '') return res.send({ status:false, message: "Home Collect User Not Found" });

        const app_date = await DataFind(`SELECT id, book_time_list FROM tbl_doctor_hos_time WHERE doctor_id = '${appoint[0].doctor_id}' AND hospital_id = '${appoint[0].hospital_id}';`);
        app_date[0].book_time_list = typeof app_date[0].book_time_list == "string" ? JSON.parse(app_date[0].book_time_list) : app_date[0].book_time_list;

        const dind = app_date[0].book_time_list.find(bt => bt[appoint[0].appointment_date]);

        if (dind) {
            const date = appoint[0].appointment_date, type = appoint[0].date_type, time = appoint[0].appointment_time;
            const timeSlots = dind[date][type];
        
            if (timeSlots) {
                const updatedSlot = timeSlots.filter(t => t !== time);
                dind[date][type] = updatedSlot;
                
                if (updatedSlot.length === 0) {
                    delete dind[date][type];
                }
                
                if (Object.keys(dind[date]).length === 0) {
                    const index = app_date[0].book_time_list.findIndex(bt => bt[date]);
                    if (index !== -1) {
                        app_date[0].book_time_list.splice(index, 1);
                    }
                }
            }
        }

        let date = new Date();
        const treatment_time = {start_time: '', end_time: date.toISOString()};

        if (appoint[0].paid_amount > 0 && customer != '') {
            const tot_amount = customer[0].tot_balance + appoint[0].paid_amount;
    
            if (await DataUpdate(`tbl_customer`, `tot_balance = '${tot_amount}'`, `id = '${customer[0].id}'`, req.hostname, req.protocol) == -1) { 
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                `'${customer[0].id}', '${appoint[0].paid_amount}', '${date.toISOString().split("T")[0]}', '0', '1', '${id}'`, req.hostname, req.protocol) == -1) { 
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }
        
        if (await DataUpdate(`tbl_booked_appointment`, `status = '5', treatment_time = '${JSON.stringify(treatment_time)}', cancel_id = '${cul}', 
            cancel_reason = ${await mysql.escape(oth)}`, `id = '${appoint[0].id}'`, req.hostname, req.protocol) == -1) { 
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        let payout_amount = Number((appoint[0].tot_price - appoint[0].site_commisiion).toFixed(2));
        if (await DataInsert(`tbl_doctor_payout_adjust`, `appointment_id, doctor_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
            `'${appoint[0].id}', '${appoint[0].doctor_id}', '${payout_amount}', '${date}', '1', '', '', '', '', '', '', '', ''`, req.hostname, req.protocol) == -1) {
            
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        if (await DataUpdate(`tbl_doctor_hos_time`, `book_time_list = '${JSON.stringify(app_date[0].book_time_list)}'`, `id = '${app_date[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appoint[0].id}', '${appoint[0].customer_id}', '${req.user.admin_id}', '${AllFunction.NotificationDate(date)}', '1', '5', 
            '❌ Your appointment has been cancelled. Please reschedule if needed. Appointment ID : # ${appoint[0].id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        const cancel_data = await DataFind(`SELECT * FROM tbl_appointment_cancel_list WHERE id = '${cul}'`);

        return res.send({ status:true, title: `${req.lan.ld.Canceled}`, message: "Appointment Cancel Successfully", cancel_data, oth });
    } catch (error) {
        console.error(error);
        return res.send({ status:false, message: "Inrenal Servre Error!" });
    }
});

router.post('/start_treatment', auth, async (req, res) => {
    try {
        const {id, otp} = req.body;
        
        const missingField = ["id", "otp"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Data Not Found" });
        
        const appoint = await DataFind(`SELECT id, customer_id, status, appointment_date, appointment_time, otp FROM tbl_booked_appointment 
                                        WHERE id = '${id}' AND doctor_id = '${req.user.admin_id}';`);
        if (appoint == '') return res.send({ status:false, message: "Appointment Not Found" });
        
        if (appoint[0].status != 1) return res.send({ status:false, message: await AllFunction.AppointmentStatus(appoint[0].status) });
        if (appoint[0].otp != Number(otp)) return res.send({ status:false, message: "Provided otp is invalid" });
        
        let sdate = new Date();
        const treatment_time = {start_time: sdate.toISOString(), end_time: ''};
        
        if (await DataUpdate(`tbl_booked_appointment`, `status = '2', otp = '${await AllFunction.otpGenerate(4)}', treatment_time = '${JSON.stringify(treatment_time)}'`, 
            `id = '${appoint[0].id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        let sm = '👨‍⚕️ Your appointment has started. Please join the session or meet the doctor. '+
                'Start time:- '+ sdate.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', 
                minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) +'';

        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appoint[0].id}', '${appoint[0].customer_id}', '${req.user.admin_id}', '${AllFunction.NotificationDate(sdate)}', '1', '2', '${sm}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        await ChatFunction.Chat_Save(req.user.admin_id, req.user.admin_id, appoint[0].customer_id, sm, 'doctor', req.hostname, req.protocol);

        return res.send({ status:true, message: "Appointment Start Successfully", title: `${req.lan.ld.Service} ${req.lan.ld.Start}`, time: ConvertTimeFormate(sdate) });
    } catch (error) {
        console.error(error);
        return res.send({ status:false, message: "Inrenal Servre Error!" });
    }
});

router.post('/check_upload_details', auth, async (req, res) => {
    try {
        const {id, fid} = req.body;

        const missingField = ["id", "fid"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Data Not Found" });

        const appoint = await DataFind(`SELECT id, status, vitals_physical, drugs_prescription, diagnosis_test FROM tbl_booked_appointment 
                                        WHERE id = '${id}' AND doctor_id = '${req.user.admin_id}';`);
        if (appoint == '') return res.send({ status:false, message: "Appointment Not Found" });
        
        appoint[0].vitals_physical = typeof appoint[0].vitals_physical == "string" ? JSON.parse(appoint[0].vitals_physical) : appoint[0].vitals_physical;
        appoint[0].drugs_prescription = typeof appoint[0].drugs_prescription == "string" ? JSON.parse(appoint[0].drugs_prescription) : appoint[0].drugs_prescription;
        appoint[0].diagnosis_test = typeof appoint[0].diagnosis_test == "string" ? JSON.parse(appoint[0].diagnosis_test) : appoint[0].diagnosis_test;
        
        const vp = appoint[0].vitals_physical.find(vpv => vpv[fid]);
        const dp = appoint[0].drugs_prescription.find(dpv => dpv[fid]);
        const dt = appoint[0].diagnosis_test.find(dtv => dtv[fid]);
        
        return res.send({ status:true, message: "Data Load Successfully", vp: vp ? 1 : 0, dp: dp ? 1 : 0, dt: dt ? 1 : 0 });
    } catch (error) {
        console.error(error);
        return res.send({ status:false, message: "Inrenal Servre Error!" });
    }
});

router.post('/patient_info_details', auth, async (req, res) => {
    try {
        const {id, fid} = req.body;

        const missingField = ["id", "fid"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Data Not Found" });

        const appoint = await DataFind(`SELECT id, status, patient_health_concerns FROM tbl_booked_appointment 
                                        WHERE id = '${id}' ${ req.user.admin_role != 1 ? 'AND doctor_id =' + req.user.admin_id : '' };`);

        const fm = await DataFind(`SELECT id, profile_image, name, gender, patient_age FROM tbl_family_member WHERE id = '${fid}'`);
        if (appoint == '' || fm == '') return res.send({ status:false, message: "Data Not Found" });
        
        appoint[0].patient_health_concerns = typeof appoint[0].patient_health_concerns == "string" ? JSON.parse(appoint[0].patient_health_concerns) : appoint[0].patient_health_concerns;
        
        const vp = appoint[0].patient_health_concerns.find(vpv => vpv.fmid == fid);
        // if (!vp) return res.send({ status:false });
        
        return res.send({ status:true, message: "Patient Details Load Successfully", ap: vp ? vp : { fmid: '', document: [], health_concern: ''}, fm:fm[0] });
    } catch (error) {
        console.error(error);
        return res.send({ status:false, message: "Inrenal Servre Error!" });
    }
});

router.post('/vituals_physical_details', auth, async (req, res) => {
    try {
        const {id, fid} = req.body;
        // console.log(req.body);
        
        const missingField = ["id", "fid"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Data Not Found" });

        let appoint = await DataFind(`SELECT id, doctor_id, vitals_physical, status FROM tbl_booked_appointment WHERE id = '${id}' ${ req.user.admin_role != 1 ? 'AND doctor_id =' + req.user.admin_id : '' };`);
        if(appoint == '') return res.send({ status:false, message: "Appointment Not Found" });

        if (req.user.admin_role != 1 && appoint[0].status != 2) {
            return res.send({ status:false, message: "Complete other step" });
        }
        // console.log(appoint);
        // console.log('appoint');
        
        let vitphy = await DataFind(`SELECT id, title FROM tbl_doctor_vitals_physical WHERE doctor_id = '${appoint[0].doctor_id}' AND status = '1';`);
        
        if(vitphy == '') return res.send({ status:false, message: "Data Not Found" });
        // console.log(vitphy);
        
        appoint[0].vitals_physical = typeof appoint[0].vitals_physical == "string" ? JSON.parse(appoint[0].vitals_physical) : appoint[0].vitals_physical;

        const uvp = appoint[0].vitals_physical.find(val => val[fid]);
        
        let vitalsMap = [];
        if (uvp) {
            vitalsMap = uvp[fid].reduce((acc, item) => {
                acc[item.id] = item.text;
                return acc;
            }, {});
        }
        
        vitphy = vitphy.map(val => ({...val, text: vitalsMap[val.id] || ''}));
        
        return res.send({ status:true, message: "Data Load Successfully", vitphy, admin_role: req.user.admin_role });
    } catch (error) {
        console.error(error);
        return res.send({ status:false, message: "Inrenal Servre Error!" });
    }
});

router.post('/add_vit_phy_data', auth, async (req, res) => {
    try {
        if (req.user.admin_role == 3) {
            let {id, fid, fullist} = req.body;
            
            const missingField = ["id", "fid", "fullist"].find(field => !req.body[field]);
            if(missingField) return res.send({ status:false, message: "Data Not Found" });
    
            fullist = typeof fullist == "string" ? JSON.parse(fullist) : fullist;

            const appoint = await DataFind(`SELECT boap.id, boap.customer_id, boap.status, boap.vitals_physical, COALESCE(cus.name) AS cus_name, COALESCE(doc.name) AS doc_name
                                            FROM tbl_booked_appointment AS boap
                                            LEFT JOIN tbl_customer AS cus ON cus.id = boap.customer_id
                                            LEFT JOIN tbl_doctor_list AS doc ON doc.id = boap.doctor_id
                                            WHERE boap.id = '${id}' AND boap.doctor_id = '${req.user.admin_id}';`);
            if (appoint == '') return res.send({ status:false, message: "Appointment Not Found" });
    
            if (appoint[0].status != 2) return res.send({ status:false, message: await AllFunction.AppointmentStatus(appoint[0].status) });
            
            appoint[0].vitals_physical = typeof appoint[0].vitals_physical == "string" ? JSON.parse(appoint[0].vitals_physical) : appoint[0].vitals_physical;
            const uvp = appoint[0].vitals_physical.find(val => val[fid]);
            
            if (uvp) uvp[fid] = fullist;
            else appoint[0].vitals_physical.unshift({ [fid] : fullist });
            
            if (await DataUpdate(`tbl_booked_appointment`, `vitals_physical = '${JSON.stringify(appoint[0].vitals_physical)}'`, `id = '${appoint[0].id}'`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
    
            sendOneNotification(`Dear ${appoint[0].cus_name}, ${appoint[0].doc_name} has updated your health records with vital and physical information — please review for your well-being`, 
                'customer', appoint[0].customer_id, 1);
            sendOneNotification(`Dear ${appoint[0].cus_name}, ${appoint[0].doc_name} has updated your health records with vital and physical information — please review for your well-being`, 
                'customer', appoint[0].customer_id, 2);
            
            return res.send({ status:true, message: "Vituals and Physical Data Add Successfully" });
            
        } else return res.send({ status: false, message: "You are not Authorised" });
    } catch (error) {
        console.error(error);
        return res.send({ status:false, message: "Inrenal Servre Error!" });
    }
});

router.get("/drugs_prescription_info", auth, async(req, res)=>{
    try {
        const { id, fid } = req.query;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "fid"], req.query);
        if (missingField.status == false) {
            req.flash('errors', `Data not Added`);
            return res.redirect("back");
        }

        const appoint = await DataFind(`SELECT id, customer_id, doctor_id, status FROM tbl_booked_appointment WHERE id = '${id}' ${ req.user.admin_role != 1 ? 'AND doctor_id =' + req.user.admin_id : '' } ORDER BY id DESC`);

        // console.log(appoint[0].status);
        
        if (appoint == '') {
            req.flash('errors', `Appointment not Added`);
            return res.redirect("back");
        }

        if (req.user.admin_role == 3) {
            if (appoint[0].status != 2) {
                req.flash('errors', `Complete Other step`);
                return res.redirect("back");
            }
        }

        const medicine = await DataFind(`SELECT * FROM tbl_doctor_medicine WHERE doctor_id = '${appoint[0].doctor_id}' ORDER BY id DESC`);

        let drlist = await DataFind(`SELECT ba.id AS appoint_id, dp.*, medi.name AS medicine_name
                                    FROM tbl_booked_appointment AS ba
                                    JOIN JSON_TABLE(
                                        JSON_EXTRACT(ba.drugs_prescription, '$[*]."${fid}"[*]'),
                                        '$[*]' COLUMNS (
                                            id INT PATH '$.id',
                                            mid INT PATH '$.mid',
                                            Days LONGTEXT PATH '$.Days',
                                            Time LONGTEXT PATH '$.Time',
                                            type LONGTEXT PATH '$.type',
                                            Dosage LONGTEXT PATH '$.Dosage',
                                            Frequency LONGTEXT PATH '$.Frequency',
                                            Instructions LONGTEXT PATH '$.Instructions'
                                        )
                                    ) AS dp 
                                    JOIN tbl_doctor_medicine AS medi ON dp.mid = medi.id AND medi.status = '1'
                                    WHERE ba.id = '${id}' AND medi.doctor_id = '${appoint[0].doctor_id}';`);
        
        // if (req.user.admin_role == 1 && drlist == '') {
        //     req.flash('errors', `Data not Added`);
        //     return res.redirect("back");
        // }

        res.render("doctor_booking_dur_pres", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, drlist, medicine, appoint: appoint[0], fid
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post('/update_drug_prescription', auth, async (req, res) => {
    try {
        if (req.user.admin_role == 3) {
            const { id, fid, dpid, medicine, types, frequency, dosage, days, time, instructions } = req.body;
            
            const missingField = ["id", "fid"].find(field => !req.body[field]);
            if(missingField) return res.send({ status:false, message: "Data Not Found" });
    
            const appoint = await DataFind(`SELECT boap.id, boap.customer_id, boap.status, boap.drugs_prescription, COALESCE(cus.name) AS cus_name, COALESCE(doc.name) AS doc_name
                                            FROM tbl_booked_appointment AS boap
                                            LEFT JOIN tbl_customer AS cus ON cus.id = boap.customer_id
                                            LEFT JOIN tbl_doctor_list AS doc ON doc.id = boap.doctor_id
                                            WHERE boap.id = '${id}' AND boap.doctor_id = '${req.user.admin_id}';`);
    
            if (appoint == '') return res.send({ status:false, message: "Appointment Not Found" });
    
            if (appoint[0].status != 2) return res.send({ status:false, message: await AllFunction.AppointmentStatus(appoint[0].status) });
    
            appoint[0].drugs_prescription = typeof appoint[0].drugs_prescription == "string" ? JSON.parse(appoint[0].drugs_prescription) : appoint[0].drugs_prescription;
    
            let dp = { id: dpid, mid: medicine, type: types, Dosage: dosage, Frequency: frequency, Days: days, Time: time, Instructions: instructions };
            
            if (await DataUpdate(`tbl_booked_appointment`, `drugs_prescription = '[]'`, `id = '${appoint[0].id}'`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
    
            let dpf = appoint[0].drugs_prescription.find(val => val[fid]);
            if (dpf) {
                let avp = dpf[fid].find(val => val.id == dp.id);
                if (!avp) {
                    delete dp.id
                    console.log(dpf[fid][0].id);
                    
                    let tidl = dpf[fid][0].id+1
                    console.log(tidl);
                    
                    dpf[fid].unshift({id: tidl, ...dp});
                    dp.id = tidl;
                } else {
                    avp.mid = dp.mid; avp.type = dp.type; avp.Dosage = dp.Dosage; avp.Frequency = dp.Frequency; avp.Days = dp.Days; avp.Time = dp.Time; avp.Instructions = dp.Instructions; 
                }
            } else {
                delete dp.id;
                appoint[0].drugs_prescription.unshift({[fid]: [{id: 1, ...dp}]})
            }
    
            if (await DataUpdate(`tbl_booked_appointment`, `drugs_prescription = '${JSON.stringify(appoint[0].drugs_prescription)}'`, `id = '${appoint[0].id}'`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
    
            sendOneNotification(`Dear ${appoint[0].cus_name}, ${appoint[0].doc_name} has added your prescription details — please review for your care.`, 
                'customer', appoint[0].customer_id, 1);
            sendOneNotification(`Dear ${appoint[0].cus_name}, ${appoint[0].doc_name} has added your prescription details — please review for your care.`, 
                'customer', appoint[0].customer_id, 2);
            
            const medi = await DataFind(`SELECT * FROM tbl_doctor_medicine WHERE id = '${dp.mid}' AND status = '1' ORDER BY id DESC`);
            
            return res.send({ status:true, message: "Drugs & Prescription detail add successfully.", dp: { medi: medi[0].name, ...dp } });
            
        } else return res.send({ status:false, message: "You are not authorised!" });
    } catch (error) {
        console.error(error);
        return res.send({ status:false, message: "Inrenal Servre Error!" });
    }
});

router.post('/delete_drug_prescription', auth, async (req, res) => {
    try {
        if (req.user.admin_role == 3) {
            const { id, fid, d_id } = req.body;
            
            const missingField = ["id", "fid"].find(field => !req.body[field]);
            if(missingField) return res.send({ status:false, message: "Data Not Found" });

            const appoint = await DataFind(`SELECT id, customer_id, status, drugs_prescription FROM tbl_booked_appointment WHERE id = '${id}' AND doctor_id = '${req.user.admin_id}'`);
            if (appoint == '') return res.send({ status:false, message: "Appointment Not Found" });

            if (appoint[0].status != 2) return res.send({ status:false, message: await AllFunction.AppointmentStatus(appoint[0].status) });

            appoint[0].drugs_prescription = typeof appoint[0].drugs_prescription == "string" ? JSON.parse(appoint[0].drugs_prescription) : appoint[0].drugs_prescription;

            let dpf = appoint[0].drugs_prescription.find(val => val[fid]);
            
            if (dpf) {
                let avp = dpf[fid].findIndex(val => val.id == d_id);

                if (avp != -1) {
                    dpf[fid].splice(avp, 1);
                    if (await DataUpdate(`tbl_booked_appointment`, `drugs_prescription = '${JSON.stringify(appoint[0].drugs_prescription)}'`, `id = '${appoint[0].id}'`, req.hostname, req.protocol) == -1) {
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
                    return res.send({ status:true, message: "Drugs & Prescription Detail Delete Successfully.", d_id });
                }
            }

            return res.send({ status:false, message: "Data Not Found" });
        } else return res.send({ status:false, message: "You are not authorised!" });
    } catch (error) {
        console.error(error);
        return res.send({ status:false, message: "Inrenal Servre Error!" });
    }
});

router.post('/doc_appo_diagnosis_list', auth, async (req, res) => {
    try {
        const { id, fid } = req.body;

        const missingField = ["id", "fid"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Data Not Found" });
        
        let appoint = await DataFind(`SELECT id, doctor_id, status, diagnosis_test FROM tbl_booked_appointment WHERE id = '${id}' ${ req.user.admin_role != 1 ? 'AND doctor_id =' + req.user.admin_id : '' };`);
        if(appoint == '') return res.send({ status:false, message: "Appointment Not Found" });

        if (req.user.admin_role == 3) {
            if (appoint[0].status != 2) return res.send({ status:false, message: "Complete Other step!" });
        }

        const diagnosis = await DataFind(`SELECT id, name, description FROM tbl_doctor_diagnosis_test WHERE doctor_id = '${appoint[0].doctor_id}' AND status = '1';`);
        if(diagnosis == '') return res.send({ status:false, message: "tests Not Found" });

        appoint[0].diagnosis_test = typeof appoint[0].diagnosis_test == "string" ? JSON.parse(appoint[0].diagnosis_test) : appoint[0].diagnosis_test;

        let dt = appoint[0].diagnosis_test.find(val => val[fid]);
        dt = dt ? dt[fid] : [];
        
        diagnosis.map(val => {
            val.status = dt.includes(val.id) == true ? 1 : 0;
        });

        return res.send({ status:true, message: "Data Load Successfully", diagnosis, admin_role: req.user.admin_role });
    } catch (error) {
        console.error(error);
        return res.send({ status:false, message: "Inrenal Servre Error!" });
    }
});

router.post('/web_add_appo_diagnosis', auth, async (req, res) => {
    try {
        const { id, fid, dtdata } = req.body;
        
        const missingField = ["id", "fid"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Data Not Found" });

        const appoint = await DataFind(`SELECT boap.id, boap.customer_id, boap.status, boap.diagnosis_test, COALESCE(cus.name) AS cus_name, COALESCE(doc.name) AS doc_name
                                        FROM tbl_booked_appointment AS boap
                                        LEFT JOIN tbl_customer AS cus ON cus.id = boap.customer_id
                                        LEFT JOIN tbl_doctor_list AS doc ON doc.id = boap.doctor_id
                                        WHERE boap.id = '${id}' AND boap.doctor_id = '${req.user.admin_id}';`);
        
        if (appoint == '') return res.send({ status:false, message: "Appointment Not Found" });
        if (appoint[0].status != 2) return res.send({ status:false, message: await AllFunction.AppointmentStatus(appoint[0].status) });

        appoint[0].diagnosis_test = typeof appoint[0].diagnosis_test == "string" ? JSON.parse(appoint[0].diagnosis_test) : appoint[0].diagnosis_test;
        
        let dt = appoint[0].diagnosis_test.findIndex(val => val[fid]), check = 0;

        if (dt != -1) {
            if ([...dtdata].length > 0) appoint[0].diagnosis_test[dt][fid] = [...dtdata].map(val => Number(val));
            else {
                appoint[0].diagnosis_test.splice(dt, 1);
                check = 1;
            }
        } else appoint[0].diagnosis_test.unshift({[fid]: [...dtdata].map(val => Number(val))});
    
        if (await DataUpdate(`tbl_booked_appointment`, `diagnosis_test = '${JSON.stringify(appoint[0].diagnosis_test)}'`, `id = '${appoint[0].id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        sendOneNotification(`Dear ${appoint[0].cus_name}, ${appoint[0].doc_name} has recommended diagnostic tests for you — please review for further guidance.`, 
                            'customer', appoint[0].customer_id, 1);
        sendOneNotification(`Dear ${appoint[0].cus_name}, ${appoint[0].doc_name} has recommended diagnostic tests for you — please review for further guidance.`, 
                            'customer', appoint[0].customer_id, 2);

        return res.send({ status:true, message: "Diagnosis Tests Update Successfully.", check });
    } catch (error) {
        console.error(error);
        return res.send({ status:false, message: "Inrenal Servre Error!" });
    }
});

router.post('/check_paid_status', auth, async (req, res) => {
    try {
        const { id, otp } = req.body;
        
        const missingField = ["id", "otp"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Data Not Found" });

        const appoint = await DataFind(`SELECT id, tot_price, paid_amount, status, otp, treatment_time FROM tbl_booked_appointment WHERE id = '${id}' AND doctor_id = '${req.user.admin_id}';`);
        if (appoint == '') return res.send({ status:false, message: "Appointment Not Found" });
        
        appoint[0].treatment_time = typeof appoint[0].treatment_time == "string" ? JSON.parse(appoint[0].treatment_time) : appoint[0].treatment_time;

        if (appoint[0].status != 2) return res.send({ status:false, message: await AllFunction.AppointmentStatus(appoint[0].status) });
        if (appoint[0].otp != Number(otp)) return res.send({ status:false, message: "Provide valid otp" });

        let date = new Date().toISOString();
        appoint[0].treatment_time.end_time = date;

        if (await DataUpdate(`tbl_booked_appointment`, `status = '3', treatment_time = '${JSON.stringify(appoint[0].treatment_time)}'`, `id = '${appoint[0].id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        return res.send({ status:true, message: "Appointment End Successfully.", check: appoint[0].tot_price == appoint[0].paid_amount ? 4 : 3,
                        title: appoint[0].tot_price == appoint[0].paid_amount ? `${req.lan.ld.Completed}` : `${req.lan.ld.Service} ${req.lan.ld.End}`, time: ConvertTimeFormate(date) });
    } catch (error) {
        console.error(error);
        return res.send({ status:false, message: "Inrenal Servre Error!" });
    }
});


router.post('/end_treatment', auth, async (req, res) => {
    try {
        const {id, otp} = req.body;
        
        const missingField = ["id"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Data Not Found" });

        if (await DataUpdate(`tbl_customer`, `pending_ref = '145'`, `id = '162'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        const ap = await DataFind(`SELECT boap.id, boap.customer_id, boap.doctor_id, boap.tot_price, boap.paid_amount, boap.wallet_amount, boap.site_commisiion, boap.wallet_amount, boap.payment_id, 
                                    boap.status, boap.appointment_date, boap.appointment_time, boap.treatment_time, boap.otp, COALESCE(cus.name, '') AS cus_name, 
                                    COALESCE(cus.pending_ref, '') AS pending_ref, COALESCE(cus.tot_balance, '') AS tot_balance, COALESCE(doc.name, '') AS doc_name, 
                                    COALESCE(doc.wallet, 0) AS doc_wallet, COALESCE(doc.cash_amount, 0) AS doc_cash_amount, COALESCE(doc.tot_payout, 0) AS doc_tot_payout, 
                                    0 AS payout_amount, 0 AS cash_amount, 0 AS pay_cash
                                    FROM tbl_booked_appointment AS boap
                                    LEFT JOIN tbl_customer AS cus ON cus.id = boap.customer_id
                                    LEFT JOIN tbl_doctor_list AS doc ON doc.id = boap.doctor_id
                                    WHERE boap.id = '${id}' AND boap.doctor_id = '${req.user.admin_id}';`);

        if (ap == '') return res.send({ status:false, message: "Appointment Not Found" });
        const appo = ap[0];

        appo.treatment_time = typeof appo.treatment_time == "string" ? JSON.parse(appo.treatment_time) : appo.treatment_time;
        
        if (appo.status == 2) {
            if (!otp) return res.send({ status:false, message: "Data Not Found" });
            if (appo.otp != Number(otp)) return res.send({ status:false, message: "Provide valid otp" });
        }
        
        if (appo.payment_id != '16') appo.payout_amount = Number((appo.tot_price - appo.site_commisiion).toFixed(2));
        else {
            appo.pay_cash = Math.max(0, Number((appo.site_commisiion - appo.wallet_amount).toFixed(2)));
            appo.payout_amount = Math.max(0, Number((appo.wallet_amount - appo.site_commisiion).toFixed(2)));
            appo.paid_amount = appo.tot_price;
        }

        let date = new Date().toISOString();
        if (appo.pay_cash > 0) {
            if (await DataInsert(`tbl_doctor_cash_adjust`, `appointment_id, doctor_id, status, proof_image, amount, date, payment_type, c_status`, 
                `'${appo.id}', '${appo.doctor_id}', '1', '', '${appo.pay_cash}', '${date}', '', ''`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
            appo.doc_cash_amount = Number((appo.doc_cash_amount + appo.pay_cash).toFixed(2));

        }
        
        if (appo.payout_amount > 0) {

            if (await DataInsert(`tbl_doctor_payout_adjust`, `appointment_id, doctor_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                `'${appo.id}', '${appo.doctor_id}', '${appo.payout_amount}', '${date}', '1', '', '', '', '', '', '', '', ''`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
            appo.doc_tot_payout = Number((appo.doc_tot_payout + appo.payout_amount).toFixed(2));
        }

        appo.doc_wallet = Number(( appo.doc_wallet + (appo.tot_price - appo.site_commisiion)).toFixed(2)); 
        
        if (await DataUpdate(`tbl_doctor_list`, `wallet = '${appo.doc_wallet}', cash_amount = '${appo.doc_cash_amount}', tot_payout = '${appo.doc_tot_payout}'`,
            `id = '${req.user.admin_id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }


        if (appo.treatment_time.end_time != '') {
            appo.treatment_time.end_time = date;
        }
        if (await DataUpdate(`tbl_booked_appointment`, `status = ${appo.tot_price == appo.paid_amount ? '4' : '3'}, paid_amount = '${appo.tot_price}', otp = '0' 
            ${appo.treatment_time.end_time != '' ? `,treatment_time = '${JSON.stringify(appo.treatment_time)}'` : '' }`, 
            `id = '${appo.id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        if (appo.pending_ref != '') {
            await AllFunction.SetReferralAmount(appo.pending_ref, appo.customer_id, appo.tot_balance);
        }

        let ms = `Hello ${appo.cus_name}, ${appo.doc_name} has recommended a treatment plan for you, please review it for better health!`;
        sendOneNotification(ms, 'customer', appo.customer_id, 1);
        sendOneNotification(ms, 'customer', appo.customer_id, 2);
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appo.id}', '${appo.customer_id}', '${appo.doctor_id}', '${AllFunction.NotificationDate(date)}', '1', '${appo.tot_price == appo.paid_amount ? '4' : '3'}', '${ms}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        if (appo.status == 2) {
            return res.send({ status:true, message: "Appointment Complete Successfully.", check: appo.tot_price == appo.paid_amount ? 4 : 3,
                title: appo.tot_price == appo.paid_amount ? `${req.lan.ld.Completed}` : `${req.lan.ld.Service} ${req.lan.ld.End}` });
        }
            
        return res.send({ status:true, message: "Appointment Complete Successfully.", check: 4, title: `${req.lan.ld.Completed}`, 
                            time: appo.treatment_time.end_time != '' ? ConvertTimeFormate(date) : '' });
    } catch (error) {
        console.error(error);
        return res.send({ status:false, message: "Inrenal Servre Error!" });
    }
});





module.exports = router;