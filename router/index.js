/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { DataFind } = require("../middleware/database_query");



router.get("/valid_license", auth, async(req, res)=>{
    try {
        const general = await DataFind(`SELECT * FROM tbl_general_settings`);

        res.render("valid_license", {
            general:general[0]
        });
    } catch (error) {
        console.log(error);
    }
});


router.get("/index", auth, async(req, res)=>{
    try {

        if (req.user.admin_role == "1") {
            const [das, doc_appoint, order_list, bl] = await Promise.all([
                DataFind(`SELECT 
                            (SELECT COUNT(*) FROM tbl_customer) AS tot_cus,
                            (SELECT COUNT(*) FROM tbl_doctor_list) AS tot_doc,
                            (SELECT COUNT(*) FROM tbl_lab_list) AS tot_lab,
                            (SELECT COUNT(*) FROM tbl_booked_appointment) AS tot_doc_appint,
                            (SELECT COUNT(*) FROM tbl_order_product) AS tot_medi_order,
                            (SELECT COUNT(*) FROM tbl_lab_booking) AS tot_lab_appoint`),
    
                DataFind(`SELECT bap.id, bap.appointment_date, bap.appointment_time, bap.show_type, bap.status, bap.tot_price, bap.paid_amount,
                            COALESCE(cus.image) AS cus_image, COALESCE(cus.name) AS name, COALESCE(doc.name) AS doc_name,
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
                            LEFT JOIN tbl_doctor_list AS doc ON doc.id = bap.doctor_id
                            ORDER BY bap.id DESC LIMIT 5;`),        
                
                DataFind(`SELECT op.id, op.customer_id, op.status, op.tot_price, op.wallet, op.date,COALESCE(cus.name, '') AS cus_name
                            FROM tbl_order_product AS op
                            LEFT JOIN tbl_customer AS cus ON cus.id = op.customer_id
                            ORDER BY op.id DESC LIMIT 5;`),     
                
                DataFind(`SELECT lb.id, lb.customer_id, lb.status, lb.book_date, lb.book_time,
                            lb.tot_price, lb.paid_amount, lb.home_extra_price,
                            lb.home_col_status, COALESCE(cus.name, '') AS cus_name,
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
                            ${req.user.admin_role != 1 ? `WHERE lb.lab_id = "${req.user.admin_id}"` : ``}
                            ORDER BY lb.id DESC LIMIT 5;`)
            ]);
    
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const formatOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone };
    
            order_list.forEach(val => {
                val.date = new Date(val.date).toLocaleString('en-US', formatOptions);
            });
            
            res.render("index_admin", {
                auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, das, doc_appoint, order_list, bl
            });



        } else if (req.user.admin_role == "3") {

            const [das, doc_appoint, order_list ] = await Promise.all([
                DataFind(`SELECT 
                            (SELECT COUNT(*) FROM tbl_booked_appointment WHERE doctor_id = '${req.user.admin_id}') AS tot_doc_appint,
                            (SELECT COUNT(*) FROM tbl_booked_appointment WHERE doctor_id = '${req.user.admin_id}' AND status = '1') AS tot_pending,
                            (SELECT COUNT(*) FROM tbl_booked_appointment WHERE doctor_id = '${req.user.admin_id}' AND status = '2') AS tot_start,
                            (SELECT COUNT(*) FROM tbl_booked_appointment WHERE doctor_id = '${req.user.admin_id}' AND status = '3') AS tot_end,
                            (SELECT COUNT(*) FROM tbl_booked_appointment WHERE doctor_id = '${req.user.admin_id}' AND status = '4') AS tot_complete,
                            (SELECT COUNT(*) FROM tbl_booked_appointment WHERE doctor_id = '${req.user.admin_id}' AND status = '5') AS tot_cancel,
                            (SELECT SUM( tot_price - site_commisiion ) FROM tbl_booked_appointment WHERE doctor_id = '${req.user.admin_id}' AND status = '4' OR status = '3') AS tot_earning,
                            (SELECT SUM( tot_price - site_commission ) FROM tbl_order_product WHERE doctor_id = '${req.user.admin_id}' AND status = '3') AS tot_pearning
                            `),
    
                DataFind(`SELECT bap.id, bap.appointment_date, bap.appointment_time, bap.show_type, bap.status, bap.tot_price, bap.paid_amount,
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
                            WHERE bap.doctor_id = '${req.user.admin_id}'
                            ORDER BY bap.id DESC LIMIT 5;`),

                DataFind(`SELECT op.id, op.customer_id, op.status, op.tot_price, op.wallet, op.date, JSON_LENGTH(COALESCE(JSON_ARRAYAGG(jt.id), 
                            JSON_ARRAY())) AS tot_product, COALESCE(cus.name, '') AS cus_name, COALESCE(payd.name, '') AS payment_name
                            FROM tbl_order_product AS op
                            JOIN JSON_TABLE(op.product_list, "$[*]"
                                COLUMNS ( id INT PATH "$.id", qty INT PATH "$.qty" )
                            ) AS jt
                            LEFT JOIN tbl_customer AS cus ON cus.id = op.customer_id
                            LEFT JOIN tbl_payment_detail AS payd ON payd.id = op.payment_id
                            WHERE op.doctor_id = '${req.user.admin_id}'
                            GROUP BY op.id
                            ORDER BY op.id DESC LIMIT 5;`),    
            ]);

            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const formatOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone };
    
            order_list.forEach(val => {
                val.date = new Date(val.date).toLocaleString('en-US', formatOptions);
            });

            let tot_earning = 0;
            if (!isNaN(das[0].tot_earning) && !isNaN(das[0].tot_pearning)) tot_earning = das[0].tot_earning + das[0].tot_pearning
            else if (!isNaN(das[0].tot_earning) && isNaN(das[0].tot_pearning)) tot_earning = das[0].tot_earning
            else if (isNaN(das[0].tot_earning) && !isNaN(das[0].tot_pearning)) tot_earning = das[0].tot_pearning
            
            res.render("index_doctor", {
                auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, das, doc_appoint, order_list, tot_earning
            });



        } else if (req.user.admin_role == "4") {

            const [das, bl ] = await Promise.all([
                DataFind(`SELECT 
                            (SELECT COUNT(*) FROM tbl_lab_booking WHERE lab_id = '${req.user.admin_id}') AS tot_doc_appint,
                            (SELECT COUNT(*) FROM tbl_lab_booking WHERE lab_id = '${req.user.admin_id}' AND status = '1') AS tot_pending,
                            (SELECT COUNT(*) FROM tbl_lab_booking WHERE lab_id = '${req.user.admin_id}' AND status = '2') AS tot_accepted,
                            (SELECT COUNT(*) FROM tbl_lab_booking WHERE lab_id = '${req.user.admin_id}' AND status = '3') AS tot_collector,
                            (SELECT COUNT(*) FROM tbl_lab_booking WHERE lab_id = '${req.user.admin_id}' AND status = '4') AS tot_ongoiong,
                            (SELECT COUNT(*) FROM tbl_lab_booking WHERE lab_id = '${req.user.admin_id}' AND status = '5') AS tot_in_progress,
                            (SELECT COUNT(*) FROM tbl_lab_booking WHERE lab_id = '${req.user.admin_id}' AND status = '6') AS tot_completed,
                            (SELECT COUNT(*) FROM tbl_lab_booking WHERE lab_id = '${req.user.admin_id}' AND status = '7') AS tot_cancelled,
                            (SELECT SUM( tot_price - site_commission ) FROM tbl_lab_booking WHERE lab_id = '${req.user.admin_id}' AND status = '6') AS tot_earning`),

                DataFind(`SELECT lb.id, lb.customer_id, lb.status, lb.book_date, lb.book_time, lb.tot_price, lb.paid_amount, lb.wallet_amount, lb.home_extra_price,
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
                            WHERE lb.lab_id = "${req.user.admin_id}"
                            ORDER BY lb.id DESC LIMIT 5;`)  
            ]);

            res.render("index_lab", {
                auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, das, bl
            });

        } else {
            req.flash('errors', `Unauthorized acces detected. please log in to proceed.!`);
            res.redirect("/");
        }
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});


router.post("/adm_chart_data", auth, async(req, res)=>{
    try {
        const doctor = await DataFind(`SELECT 
                                        DATE_FORMAT(appointment_date, '%Y-%m') AS full_month,
                                        MONTH(appointment_date) AS month,
                                        COUNT(*) AS total_appoin,
                                        SUM(site_commisiion) AS revenue
                                        FROM tbl_booked_appointment
                                        WHERE appointment_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                                        GROUP BY full_month, month ORDER BY full_month ASC;`);

        const medicine = await DataFind(`SELECT 
                                        DATE_FORMAT(date, '%Y-%m') AS full_month,
                                        MONTH(date) AS month,
                                        COUNT(*) AS total_appoin,
                                        SUM(site_commission) AS revenue
                                        FROM tbl_order_product
                                        WHERE date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                                        GROUP BY full_month, month
                                        ORDER BY full_month ASC;`);

        const lab = await DataFind(`SELECT 
                                    DATE_FORMAT(STR_TO_DATE(book_date, '%d-%m-%Y'), '%Y-%m') AS full_month,
                                    MONTH(STR_TO_DATE(book_date, '%d-%m-%Y')) AS month,
                                    COUNT(*) AS total_appoin,
                                    SUM(site_commission) AS revenue
                                    FROM tbl_lab_booking
                                    WHERE STR_TO_DATE(book_date, '%d-%m-%Y') >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                                    GROUP BY full_month, month
                                    ORDER BY full_month ASC;`);

        const makeMap = (data) => {
          const map = Object.create(null);
          for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const key = item.full_month;
            map[key] = parseFloat(item.revenue || 0);
          }
          return map;
        };

        const docMap = makeMap(doctor);
        const medMap = makeMap(medicine);
        const labMap = makeMap(lab);

        const allMonthsSet = new Set();
        for (const key in docMap) allMonthsSet.add(key);
        for (const key in medMap) allMonthsSet.add(key);
        for (const key in labMap) allMonthsSet.add(key);

        const sortedMonths = Array.from(allMonthsSet).sort();

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        const getMonthLabel = (ym) => {
            const parts = ym.split("-");
            const m = parseInt(parts[1], 10);
            return `${ym} (${monthNames[m - 1]})`;
        };

        const format = (val) => {
            const num = parseFloat(val);
            return Number.isInteger(num) ? num : parseFloat(num.toFixed(2));
        };

        const monthLabels = [];
        const docData = [];
        const mediData = [];
        const labData = [];

        for (let i = 0; i < sortedMonths.length; i++) {
            const month = sortedMonths[i];
        
            const docVal = docMap[month] || 0;
            const medVal = medMap[month] || 0;
            const labVal = labMap[month] || 0;
        
            if (docVal === 0 && medVal === 0 && labVal === 0) continue;
        
            monthLabels.push(getMonthLabel(month));
            docData.push(format(docVal));
            mediData.push(format(medVal));
            labData.push(format(labVal));
        }

        const alldata = [
            { month: monthLabels, doc: docData, medi: mediData, lab: labData }
        ];
        
        return res.json({ status: true, alldata, gn: {cur: req.general.site_currency, place: req.general.currency_placement}, amount: req.lan.ld.Amount })
    } catch (error) {
        console.log(error);
    }
});

router.post("/doc_chart_data", auth, async(req, res)=>{
    try {
        const doctor = await DataFind(`SELECT 
                                        DATE_FORMAT(appointment_date, '%Y-%m') AS full_month,
                                        CASE
                                            WHEN DAY(appointment_date) BETWEEN 1 AND 10 THEN '1'
                                            WHEN DAY(appointment_date) BETWEEN 11 AND 20 THEN '11'
                                            ELSE '21'
                                        END AS ten_day_range,
                                        COUNT(*) AS total_appoin,
                                        SUM(tot_price - site_commisiion) AS revenue
                                        FROM tbl_booked_appointment
                                        WHERE doctor_id = '${req.user.admin_id}' AND status IN (3,4)
                                        GROUP BY full_month, ten_day_range
                                        ORDER BY full_month ASC, ten_day_range ASC;`);

        const medicine = await DataFind(`SELECT 
                                            DATE_FORMAT(date, '%Y-%m') AS full_month,
                                            CASE
                                                WHEN DAY(date) BETWEEN 1 AND 10 THEN '1'
                                                WHEN DAY(date) BETWEEN 11 AND 20 THEN '11'
                                                ELSE '21'
                                            END AS ten_day_range,
                                            MONTH(date) AS month,
                                            COUNT(*) AS total_appoin,
                                            SUM(tot_price - site_commission) AS revenue
                                            FROM tbl_order_product
                                            WHERE doctor_id = '${req.user.admin_id}' AND status = '3'
                                            GROUP BY full_month, month, ten_day_range
                                            ORDER BY full_month ASC;`);
        
        const makeMap = (data) => {
            const map = Object.create(null);
            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                const key = `${item.full_month}-${item.ten_day_range.padStart(2, '0')}T00:00:00`;
                map[key] = parseFloat(item.revenue || 0);
            }
            return map;
        };

        const docMap = makeMap(doctor);
        const medMap = makeMap(medicine);

        const allKeysSet = new Set();
        for (const key in docMap) allKeysSet.add(key);
        for (const key in medMap) allKeysSet.add(key);

        const sortedKeys = Array.from(allKeysSet).sort();
        
        // console.log(sortedKeys);
        
        // const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        // const getLabel = (key) => {
            
        //     const [ym, range] = key.split("_");
        //     const [year, m] = ym.split("-");
        //     const month = parseInt(m, 10);
        //     return `${range} ${monthNames[month - 1]} ${year}`;
        // };

        const format = (val) => {
            const num = parseFloat(val);
            return Number.isInteger(num) ? num : parseFloat(num.toFixed(2));
        };

        let labels = [], docr = [], labr = [], alldata = [];

        for (let i = 0; i < sortedKeys.length; i++) {
            const key = sortedKeys[i];
            const docVal = docMap[key] || 0;
            const medVal = medMap[key] || 0;
        
            if (docVal === 0 && medVal === 0) continue;
        
            labels.push(key);
            docr.push(format(docVal));
            labr.push(format(medVal));
        }

        if (labels.length === 1) {
            const originalDate = new Date(labels[0]);       

            const prevDate = new Date(originalDate);
            prevDate.setDate(originalDate.getDate() - 10);

            const nextDate = new Date(originalDate);
            nextDate.setDate(originalDate.getDate() + 10);      

            const formatDateKey = (date) => {
                const year = date.getFullYear();
                const month = `${date.getMonth() + 1}`.padStart(2, '0');
                const day = `${date.getDate()}`.padStart(2, '0');
                return `${year}-${month}-${day}T00:00:00`;
            };      

            alldata = [{
                month: [
                    formatDateKey(prevDate),
                    labels[0],
                    formatDateKey(nextDate)
                ],
                docr: [0, docr[0], 0],
                labr: [0, labr[0], 0]
            }];
        } else {
            alldata = [
                {
                    month: labels,
                    docr: docr,
                    labr: labr,
                }
            ];
        }   

        return res.json({ status: true, alldata });
    } catch (error) {
        console.log(error);
    }
});

router.post("/lab_chart_data", auth, async(req, res)=>{
    try {
        const lab = await DataFind(`SELECT 
                                    DATE_FORMAT(STR_TO_DATE(book_date, '%d-%m-%Y'), '%Y-%m') AS full_month,
                                    CASE
                                        WHEN DAY(book_date) BETWEEN 1 AND 10 THEN '1'
                                        WHEN DAY(book_date) BETWEEN 11 AND 20 THEN '11'
                                        ELSE '21'
                                    END AS ten_day_range,
                                    MONTH(STR_TO_DATE(book_date, '%d-%m-%Y')) AS month,
                                    COUNT(*) AS total_appoin,
                                    SUM(tot_price - site_commission) AS revenue
                                    FROM tbl_lab_booking
                                    WHERE STR_TO_DATE(book_date, '%d-%m-%Y') >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH) AND lab_id = '${req.user.admin_id}' AND status = '6'
                                    GROUP BY full_month, month, ten_day_range
                                    ORDER BY full_month ASC;`);

        
        
        const formatDateKey = (d) => {
            const y = d.getFullYear();
            const m = `${d.getMonth() + 1}`.padStart(2, '0');
            const day = `${d.getDate()}`.padStart(2, '0');
            return `${y}-${m}-${day}T00:00:00`;
        };

        // Helper: pad one-point data with ±10 day empty entries
        const normalizeSingleDataPoint = (dateString, value) => {
            const date = new Date(dateString);
            const prev = new Date(date);
            prev.setDate(prev.getDate() - 10);
        
            const next = new Date(date);
            next.setDate(next.getDate() + 10);
        
            return [
                { date: formatDateKey(prev), revenue: 0 },
                { date: formatDateKey(date), revenue: value },
                { date: formatDateKey(next), revenue: 0 },
            ];
        };
        
        let labData = lab.map(item => ({
            date: `${item.full_month}-${item.ten_day_range.padStart(2, '0')}T00:00:00`,
            revenue: parseFloat(item.revenue || 0)
        }));

        if (labData.length === 1) {
            labData = normalizeSingleDataPoint(labData[0].date, labData[0].revenue);
        } else {
            labData.sort((a, b) => new Date(a.date) - new Date(b.date));
        }

        const labMap = labData.map(item => item.date);
        const labMapRev = labData.map(item => item.revenue);

        const alldata = [
            {
                month: labMap,
                revenue: labMapRev,
            }
        ];
        
        console.log(alldata);
        
        return res.json({ status: true, alldata });
    } catch (error) {
        console.log(error);
        return res.json({ status: false, alldata: [] });
    }
});

module.exports = router;