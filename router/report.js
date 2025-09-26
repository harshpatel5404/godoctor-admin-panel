/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const XLSX = require('xlsx');
const path = require("path");
const fs = require('fs-extra');
const schedule = require('node-schedule');
const { DataFind } = require("../middleware/database_query");
const AllFunction = require("../route_function/function");



function downloadFile(xlsxdata, name, filename, res) {

    const workbook = XLSX.utils.book_new();

    const worksheet = XLSX.utils.aoa_to_sheet(xlsxdata);

    XLSX.utils.book_append_sheet(workbook, worksheet, name);

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    let fname = `${filename}-${Date.now()}.xlsx`;

    const folderPath = path.resolve(__dirname, '../public/uploads/report/' + fname);

    fs.writeFile(folderPath, buffer, (err) => {
        if (err) {
            console.error("Error writing file:", err);
        } else {
            console.log("File written successfully.");
            
            if (fs.existsSync(folderPath)) {

                res.sendFile(folderPath, (err) => {
                    if (err) {
                        console.error("Error sending file:", err);
                        res.status(500).send("Error sending file");
                    } else {
                        console.log("File sent successfully.");
                        deletefile(fname);
                    }
                });
            } else {
                console.error("File does not exist:", folderPath);
            }
        }
    });
}

function deletefile(fname) {
    schedule.scheduleJob(new Date(Date.now() + 3000), async function() {
        const folder_path = "public/uploads/report/" + fname;
        fs.unlink(folder_path, (err) => {
            if (err) {
                console.error('Error deleting file:', err);
                return;
            }
            console.log('Report File deleted successfully.');
        }); 
    });
}





async function docdailyReport(where) {
    const ostatus = await DataFind(`SELECT
                                        COUNT(*) AS Today,
                                        COALESCE(SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END), 0) AS Pending,
                                        COALESCE(SUM(CASE WHEN status = '2' THEN 1 ELSE 0 END), 0) AS Start,
                                        COALESCE(SUM(CASE WHEN status = '3' THEN 1 ELSE 0 END), 0) AS End,
                                        COALESCE(SUM(CASE WHEN status = '4' THEN 1 ELSE 0 END), 0) AS Complete,
                                        COALESCE(SUM(CASE WHEN status = '5' THEN 1 ELSE 0 END), 0) AS Cancel
                                    FROM tbl_booked_appointment ${where}`);
    return ostatus;
}

async function medidailyReport(where) {
    const ostatus = await DataFind(`SELECT
                                        COUNT(*) AS today,
                                        COALESCE(SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END), 0) AS Pending,
                                        COALESCE(SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END), 0) AS Processing,
                                        COALESCE(SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END), 0) AS Ready_to_deliver,
                                        COALESCE(SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END), 0) AS Deliver,
                                        COALESCE(SUM(CASE WHEN status = 4 THEN 1 ELSE 0 END), 0) AS Canceled
                                    FROM tbl_order_product ${where}`);
    return ostatus;
}

async function labdailyReport(where) {
    const ostatus = await DataFind(`SELECT
                                        COUNT(*) AS today,
                                        COALESCE(SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END), 0) AS Pending,
                                        COALESCE(SUM(CASE WHEN status = '2' THEN 1 ELSE 0 END), 0) AS Accepted,
                                        COALESCE(SUM(CASE WHEN status = '3' THEN 1 ELSE 0 END), 0) AS Collector_Assigned,
                                        COALESCE(SUM(CASE WHEN status = '4' THEN 1 ELSE 0 END), 0) AS Ongoing,
                                        COALESCE(SUM(CASE WHEN status = '5' THEN 1 ELSE 0 END), 0) AS In_Progress,
                                        COALESCE(SUM(CASE WHEN status = '6' THEN 1 ELSE 0 END), 0) AS Completed,
                                        COALESCE(SUM(CASE WHEN status = '7' THEN 1 ELSE 0 END), 0) AS Cancelled
                                    FROM tbl_lab_booking ${where}`);
    return ostatus;
}

router.get("/daily/:id", auth, async(req, res)=>{
    try {
        let role = req.params.id, today = new Date().toISOString().split("T")[0], user_list = [], list = [], where = "", daily_list = [];

        if (role == 1 || role == 2) {
            user_list = await DataFind(`SELECT id, name FROM tbl_doctor_list 
                                        WHERE status = '1' AND logo NOT IN ("") AND name NOT IN ("") AND email NOT IN ("") AND title NOT IN ("") AND address NOT IN ("") AND latitude NOT IN (0) 
                                        AND longitude NOT IN (0)
                                        ORDER BY id DESC`);
            
            if (role == 1) {
                if (req.user.admin_role == "1") where = `WHERE appointment_date = "${today}"`;
                if (req.user.admin_role != "1") where = `WHERE appointment_date = "${today}" AND doctor_id = "${req.user.admin_id}"`;

                daily_list = await docdailyReport(where);
                list = [req.lan.ld.Pending, req.lan.ld.Start, req.lan.ld.End, req.lan.ld.Complete, req.lan.ld.Cancel];

            } else if (role == 2) {
                if (req.user.admin_role == "1") where = `WHERE DATE(date) = "${today}"`;
                if (req.user.admin_role != "1") where = `WHERE DATE(date) = "${today}" AND doctor_id = "${req.user.admin_id}"`;

                daily_list = await medidailyReport(where);
                list = [req.lan.ld.Pending, req.lan.ld.Processing, req.lan.ld.Ready_to_deliver, req.lan.ld.Deliver, req.lan.ld.Canceled];
            }
            
        } else {
            user_list = await DataFind(`SELECT id, name FROM tbl_lab_list WHERE status = '1' ORDER BY id DESC`);
            
            if (req.user.admin_role == "1") where = `WHERE STR_TO_DATE(book_date, '%d-%m-%Y') = "${today}"`;
            if (req.user.admin_role != "1") where = `WHERE STR_TO_DATE(book_date, '%d-%m-%Y') = "${today}" AND lab_id = "${req.user.admin_id}"`;

            daily_list = await labdailyReport(where);
            
            list = [req.lan.ld.Pending, req.lan.ld.Accepted, req.lan.ld.Collector_Assigned, req.lan.ld.Ongoing, req.lan.ld.In_Progress, req.lan.ld.Completed, req.lan.ld.Cancelled];
        }
        
        res.render("report_daily", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, user_list, daily_list: daily_list[0], today, list, role
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/daily_data", auth, async(req, res)=>{
    try {
        let {date, sid, role} = req.body;
        
        if (req.user.admin_role != "1") sid = req.user.admin_id;
        
        let where = "", daily_list = "";
        if (date && sid) {

            if (role == 1) where = `WHERE appointment_date = "${date}" AND doctor_id = "${sid}"`;
            if (role == 2) where = `WHERE DATE(date) = "${date}" AND doctor_id = "${sid}"`;
            if (role == 3) where = `WHERE STR_TO_DATE(book_date, '%d-%m-%Y') = "${date}" AND lab_id = "${sid}"`;

        } else if (sid) {
            if (role == 1 || role == 2) where = `WHERE doctor_id = "${sid}"`;
            if (role == 3) where = `WHERE lab_id = "${sid}"`;

        } else if(date) {
            if (role == 1) where = `WHERE appointment_date = "${date}"`;
            if (role == 2) where = `WHERE DATE(date) = "${date}"`;
            if (role == 3) where = `WHERE STR_TO_DATE(book_date, '%d-%m-%Y') = "${date}"`;
        }
        
        if (where != '') {
            if (role == 1) daily_list = await docdailyReport(where);
            if (role == 2) daily_list = await medidailyReport(where);
            if (role == 3) daily_list = await labdailyReport(where);
        }
        
        res.send({ daily_list: daily_list.length > 0 ? daily_list[0] : [] });
    } catch (error) {
        console.log(error);
        res.send({ daily_list: [] });
    }
});





async function docsbookservices(where) {
    const order_data = await DataFind(`SELECT ba.id, ba.appointment_date AS date, ba.appointment_time AS book_time, ba.status, ba.tot_price,
                                        COALESCE(cus.name, '') as cus_name, COALESCE(doc.name, '') as doctor_name, COALESCE(dhd.sub_title, '') as service_name,
                                        JSON_OBJECT(
                                            's', CASE
                                                WHEN ba.status = '1' THEN 'Pending'
                                                WHEN ba.status = '2' THEN 'Service Start'
                                                WHEN ba.status = '3' THEN 'Service End'
                                                WHEN ba.status = '4' THEN 'Completed'
                                                WHEN ba.status = '5' THEN 'Canceled'
                                                ELSE ''
                                            END,
                                            'b', CASE
                                                WHEN ba.status = '1' THEN 'btn-warning'
                                                WHEN ba.status = '2' THEN 'btn-secondary'
                                                WHEN ba.status = '3' THEN 'btn-primary'
                                                WHEN ba.status = '4' THEN 'btn-success'
                                                WHEN ba.status = '5' THEN 'btn-danger'
                                                ELSE ''
                                            END
                                        ) AS status_type
                                        FROM tbl_booked_appointment AS ba
                                        LEFT join tbl_customer AS cus on ba.customer_id = cus.id
                                        LEFT join tbl_doctor_list AS doc on ba.doctor_id = doc.id
                                        LEFT join tbl_doctor_hos_depart_list AS dhd on ba.sub_depar_id = dhd.id
                                        ${where} ORDER BY ba.id DESC`);
    return order_data;
}

async function medisbookservices(where) {
    const order_data = await DataFind(`SELECT op.id, op.date, op.status, op.tot_price,
                                        COALESCE(cus.name, '') as cus_name, COALESCE(doc.name, '') as doctor_name,
                                        JSON_OBJECT(
                                            's', CASE
                                                WHEN op.status = '0' THEN 'Pending'
                                                WHEN op.status = '1' THEN 'Processing'
                                                WHEN op.status = '2' THEN 'Ready to deliver'
                                                WHEN op.status = '3' THEN 'Deliver'
                                                WHEN op.status = '4' THEN 'Canceled'
                                                ELSE ''
                                            END,
                                            'b', CASE
                                                WHEN op.status = '0' THEN 'btn-secondary'
                                                WHEN op.status = '1' THEN 'btn-info'
                                                WHEN op.status = '2' THEN 'btn-primary'
                                                WHEN op.status = '3' THEN 'btn-success'
                                                WHEN op.status = '4' THEN 'btn-danger'
                                                ELSE ''
                                            END
                                        ) AS status_type
                                        FROM tbl_order_product AS op
                                        LEFT join tbl_customer AS cus on op.customer_id = cus.id
                                        LEFT join tbl_doctor_list AS doc on op.doctor_id = doc.id
                                        ${where} ORDER BY op.id DESC`);
    return order_data;
}

async function labsbookservices(where) {
    const order_data = await DataFind(`SELECT lb.id, STR_TO_DATE(lb.book_date, '%d-%m-%Y') AS book_date, lb.book_time, lb.status, lb.tot_price,
                                        COALESCE(cus.name, '') as cus_name, COALESCE(lab.name, '') as lab_name, COALESCE(lc.name, '') as category_name,
                                        JSON_OBJECT(
                                            's', CASE
                                                WHEN lb.status = '1' THEN 'Pending'
                                                WHEN lb.status = '2' THEN 'Accepted'
                                                WHEN lb.status = '3' THEN 'Assign User'
                                                WHEN lb.status = '4' THEN 'Ongoing'
                                                WHEN lb.status = '5' THEN 'In Progress'
                                                WHEN lb.status = '6' THEN 'Completed'
                                                WHEN lb.status = '7' THEN 'Canceled'
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
                                        FROM tbl_lab_booking AS lb
                                        LEFT join tbl_customer AS cus on lb.customer_id = cus.id
                                        LEFT join tbl_lab_list AS lab on lb.lab_id = lab.id
                                        LEFT join tbl_lab_category AS lc on lb.category_id = lc.id
                                        ${where} ORDER BY lb.id DESC`);
    return order_data;
}

async function sbookQuery(sitter, start, end, status, role) {
    let services = [], where = "", duid = '', ddate = '', dstatus = '';

    if (role == 1) {
        duid = 'ba.doctor_id'; ddate = 'ba.appointment_date'; dstatus = 'ba.status';
    } else if (role == 2) {
        duid = 'op.doctor_id'; ddate = 'DATE(op.date)'; dstatus = 'op.status';
    } else if (role == 3) {
        duid = 'lb.lab_id'; ddate = `STR_TO_DATE(lb.book_date, '%d-%m-%Y')`; dstatus = 'lb.status';
    }

    if (sitter && start && end && status) {
        where = `WHERE ${duid} = "${sitter}" AND ${ddate} >= "${start}" AND ${ddate} <= "${end}" AND ${dstatus} = "${status}"`;

    } else if(sitter && start && end) {
        where = `WHERE ${duid} = "${sitter}" AND ${ddate} >= "${start}" AND ${ddate} <= "${end}"`;

    } else if(sitter && end && status ) {
        where = `WHERE ${duid} = "${sitter}" AND ${ddate} <= "${end}" AND ${dstatus} = "${status}"`;

    } else if(sitter && start && status ) {
        where = `WHERE ${duid} = "${sitter}" AND ${ddate} >= "${start}" AND ${dstatus} = "${status}"`;

    } else if(start && end && status) {
        where = `WHERE ${ddate} >= "${start}" AND ${ddate} <= "${end}" AND ${dstatus} = "${status}"`;

    } else if(sitter && start ) {
        where = `WHERE ${duid} = "${sitter}" AND ${ddate} >= "${start}"`;

    } else if(sitter && end) {
        where = `WHERE ${duid} = "${sitter}" AND ${ddate} <= "${end}"`;

    } else if(sitter && status) {
        where = `WHERE ${duid} = "${sitter}" AND ${dstatus} = "${status}"`;

    } else if(start && end) {
        where = `WHERE ${ddate} >= "${start}" AND ${ddate} <= "${end}"`;

    } else if(start && status) {
        where = `WHERE ${ddate} >= "${start}" AND ${dstatus} = "${status}"`;

    } else if(end && status) {
        where = `WHERE ${ddate} <= "${end}" AND ${dstatus} = "${status}"`;

    } else if(sitter) {
        where = `WHERE ${duid} = "${sitter}" `;

    } else if(start) {
        where = `WHERE ${ddate} >= "${start}"`;

    } else if(end) {
        where = `WHERE ${ddate} <= "${end}"`;

    } else if (status) {
        where = `WHERE ${dstatus} = "${status}"`;
    }
    
    if (where != '') {
        if (role == 1) {
            services = await docsbookservices(where);
            services.map(av => {
                let dateOnly = new Date(av.date).toISOString().split('T')[0];
                av.date = AllFunction.NotificationDate(`${dateOnly} ${av.book_time}`);
            });

        } else if (role == 2) {
            services = await medisbookservices(where);
            services.map(av => {
                av.date = AllFunction.NotificationDate(av.date);
            });
        } else if (role == 3) {
            services =await labsbookservices(where);
            services.map(av => {
                let dateOnly = new Date(av.book_date).toISOString().split('T')[0];
                av.date = AllFunction.NotificationDate(`${dateOnly} ${av.book_time}`);
            });
            
        }
    }
    
    return services;
}

router.get("/book_service/:id", auth, async(req, res)=>{
    try {
        let role = req.params.id, user_list = [], list = [], where = "", allservices = [];
        
        if (role == 1 || role == 2) {
            user_list = await DataFind(`SELECT id, name FROM tbl_doctor_list 
                                        WHERE status = '1' AND logo NOT IN ("") AND name NOT IN ("") AND email NOT IN ("") AND title NOT IN ("") AND address NOT IN ("") AND latitude NOT IN (0) 
                                        AND longitude NOT IN (0)
                                        ORDER BY id DESC`);
            
            if (role == 1) {
                if (req.user.admin_role != "1") where = `WHERE ba.doctor_id = "${req.user.admin_id}"`;
                
                allservices = await docsbookservices(where);
                
            } else if (role == 2) {
                if (req.user.admin_role != "1") where = `WHERE op.doctor_id = "${req.user.admin_id}"`;

                allservices = await medisbookservices(where);
            }
            
        } else {
            user_list = await DataFind(`SELECT id, name FROM tbl_lab_list WHERE status = '1' ORDER BY id DESC`);
            
            if (req.user.admin_role != "1") where = `WHERE lb.lab_id = "${req.user.admin_id}"`;

            allservices = await labsbookservices(where);
        }


        if (role == 1) {
            allservices = await docsbookservices(where);
            allservices.map(av => {
                let dateOnly = new Date(av.date).toISOString().split('T')[0];
                av.date = AllFunction.NotificationDate(`${dateOnly} ${av.book_time}`);
            });

        } else if (role == 2) {
            allservices = await medisbookservices(where);
            allservices.map(av => {
                av.date = AllFunction.NotificationDate(av.date);
            });
        } else if (role == 3) {
            allservices =await labsbookservices(where);
            allservices.map(av => {
                let dateOnly = new Date(av.book_date).toISOString().split('T')[0];
                av.date = AllFunction.NotificationDate(`${dateOnly} ${av.book_time}`);
            });
        }
        
        let torder = allservices != '' ? allservices.length : 0;

        res.render("report_book_appoint", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, user_list, allservices, torder, role
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/sbook_service", auth, async(req, res)=>{
    try {
        let {user, start, end, status, role} = req.body;

        if (req.user.admin_role != "1") user = req.user.admin_id;

        let services = await sbookQuery(user, start, end, status, role);      

        let torder = services != "" ? services.length : 0;

        res.send({ services, torder });
    } catch (error) {
        console.log(error);
    }
});

router.post("/dbook", auth, async (req, res) => {
    try {
        let { sitter, start, end, status, role } = req.body;

        if (req.user.admin_role != "1") sitter = (req.user.admin_id).toString();
        
        let allservices = [];
        if (sitter || start || end || status || role) {
            allservices = await sbookQuery(user, start, end, status, role);
        } else {
            if (role == 1) allservices = await docsbookservices(`AND ba.doctor_id = "${req.user.admin_id}" `);
            else if (role == 2) allservices = await medisbookservices(`AND op.doctor_id = "${req.user.admin_id}" `);
            else if (role == 3) allservices = await labsbookservices(`AND lb.lab_id = "${req.user.admin_id}" `);
        }

        let xlsxdata = [["Service Id", "Date", "Price", "Customer", "Sitter", "Service", "Status"]];
        allservices.forEach(sdata => {
            let data = [sdata.order_id, sdata.date, sdata.tot_price, sdata.cus_name, sdata.sitt_name, sdata.service_name, sdata.sta_name];
            xlsxdata.push(data);
        });

        if (xlsxdata.length > 0) {
            downloadFile(xlsxdata, 'services', 'Bookservices', res);
        }
    } catch (error) {
        console.log(error);
    }
});





async function docscommissionservices(where) {
    
    const order_data = await DataFind(`SELECT ba.id, ba.site_commisiion as site_comi, (ba.tot_price - ba.site_commisiion) AS doc_comi, ba.tot_price, 
                                        ba.appointment_date AS date, ba.appointment_time AS book_time, COALESCE(doc.name, '') as doc_name, 
                                        COALESCE(cus.name, '') as cus_name
                                        FROM tbl_booked_appointment AS ba
                                        LEFT JOIN tbl_doctor_list AS doc ON ba.doctor_id = doc.id
                                        LEFT JOIN tbl_customer AS cus ON ba.customer_id = cus.id
                                        ${where} ORDER BY ba.id DESC`);
    
    return order_data;
}

async function mediscommissionservices(where) {
    const order_data = await DataFind(`SELECT op.id, op.site_commission as site_comi, (op.tot_price - op.site_commission) as doc_comi, op.tot_price, op.date,
                                        COALESCE(doc.name, '') as doc_name, COALESCE(cus.name, '') as cus_name
                                        FROM tbl_order_product AS op
                                        LEFT JOIN tbl_doctor_list AS doc ON op.doctor_id = doc.id
                                        LEFT JOIN tbl_customer AS cus ON op.customer_id = cus.id
                                        ${where} ORDER BY op.id DESC`);

    return order_data;
}

async function labscommissionservices(where) {
    const order_data = await DataFind(`SELECT lb.id, lb.site_commission as site_comi, (lb.tot_price - lb.site_commission) as doc_comi, lb.tot_price, 
                                        STR_TO_DATE(lb.book_date, '%d-%m-%Y') AS book_date, lb.book_time, COALESCE(lab.name, '') as doc_name, COALESCE(cus.name, '') as cus_name
                                        FROM tbl_lab_booking AS lb
                                        LEFT JOIN tbl_lab_list AS lab ON lb.lab_id = lab.id
                                        LEFT JOIN tbl_customer AS cus ON lb.customer_id = cus.id
                                        ${where} ORDER BY lb.id DESC`);

    return order_data;
}

async function commissionQuery(start, end, sitter, role) {
    let allservices = [], where = "", duid = '', ddate = '', sitecom = 0, usercom = 0;;

    if (role == 1) {
        duid = 'ba.doctor_id'; ddate = 'ba.appointment_date';
    } else if (role == 2) {
        duid = 'op.doctor_id'; ddate = 'DATE(op.date)'; 
    } else if (role == 3) {
        duid = 'lb.lab_id'; ddate = `STR_TO_DATE(lb.book_date, '%d-%m-%Y')`;
    }

    if (start && end && sitter) {
        where = `WHERE ${duid} = "${sitter}" AND ${ddate} >= "${start}" AND ${ddate} <= "${end}"`;
        
    } else if(start && end) {
        where = `WHERE ${ddate} >= "${start}" AND ${ddate} <= "${end}"`;
        
    } else if(start && sitter) {
        where = `WHERE ${duid} = "${sitter}" AND ${ddate} >= "${start}" `;
        
    } else if(end && sitter) {
        where = `WHERE ${duid} = "${sitter}" AND ${ddate} <= "${end}"`;
        
    } else if(start) {
        where = `WHERE ${ddate} >= "${start}"`;
        
    } else if(end) {
        where = `WHERE ${ddate} <= "${end}"`;
        
    } else if(sitter) {
        where = `WHERE ${duid} = "${sitter}"`;
    }

    if (role == 1) {
        allservices = await docscommissionservices(where);
        allservices.map(av => {
            let dateOnly = new Date(av.date).toISOString().split('T')[0];
            av.date = AllFunction.NotificationDate(`${dateOnly} ${av.book_time}`);

            sitecom += Number(av.site_comi);
            usercom += Number(av.doc_comi);
        });

    } else if (role == 2) {
        allservices = await mediscommissionservices(where);
        allservices.map(av => {
            av.date = AllFunction.NotificationDate(av.date);

            sitecom += Number(av.site_comi);
            usercom += Number(av.doc_comi);
        });

    } else if (role == 3) {
        allservices = await labscommissionservices(where);
        allservices.map(av => {
            let dateOnly = new Date(av.book_date).toISOString().split('T')[0];
            av.date = AllFunction.NotificationDate(`${dateOnly} ${av.book_time}`);

            sitecom += Number(av.site_comi);
            usercom += Number(av.doc_comi);
        });
    }

    return { allservices, sitecom, usercom  };
}

router.get("/commission/:id", auth, async(req, res)=>{
    try {
        let role = req.params.id, user_list = [], where = "", allservices = [], sitecom = 0, usercom = 0;

        if (role == 1 || role == 2) {
            user_list = await DataFind(`SELECT id, name FROM tbl_doctor_list 
                                        WHERE status = '1' AND logo NOT IN ("") AND name NOT IN ("") AND email NOT IN ("") AND title NOT IN ("") AND address NOT IN ("") AND latitude NOT IN (0) 
                                        AND longitude NOT IN (0)
                                        ORDER BY id DESC`);
            
            if (role == 1) {
                if (req.user.admin_role != "1") where = `WHERE ba.doctor_id = "${req.user.admin_id}"`;
                
                allservices = await docscommissionservices(where);

            } else if (role == 2) {
                if (req.user.admin_role != "1") where = `WHERE op.doctor_id = "${req.user.admin_id}"`;

                allservices = await mediscommissionservices(where);
                
            }
            
        } else {
            user_list = await DataFind(`SELECT id, name FROM tbl_lab_list WHERE status = '1' ORDER BY id DESC`);
            
            if (req.user.admin_role != "1") where = `WHERE lb.lab_id = "${req.user.admin_id}"`;

            allservices = await labscommissionservices(where);

        }

        if (role == 1) {
            
            allservices.map(av => {
                let dateOnly = new Date(av.date).toISOString().split('T')[0];
                av.date = AllFunction.NotificationDate(`${dateOnly} ${av.book_time}`);

                sitecom += Number(av.site_comi);
                usercom += Number(av.doc_comi);
            });

        } else if (role == 2) {
            allservices.map(av => {
                av.date = AllFunction.NotificationDate(av.date);

                sitecom += Number(av.site_comi);
                usercom += Number(av.doc_comi);
            });

        } else if (role == 3) {
            allservices.map(av => {
                let dateOnly = new Date(av.book_date).toISOString().split('T')[0];
                av.date = AllFunction.NotificationDate(`${dateOnly} ${av.book_time}`);

                sitecom += Number(av.site_comi);
                usercom += Number(av.doc_comi);
            });
        }

        let totservice = allservices.length > 0 ? allservices.length : 0;

        res.render("report_commission", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, user_list, allservices, sitecom, usercom, totservice, role
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/scommission", auth, async(req, res)=>{
    try {
        let { start, end, sitter, role } = req.body;

        if (req.user.admin_role != "1") sitter = req.user.admin_id;

        let services = await commissionQuery(start, end, sitter, role);

        let allservices = services.allservices
        let totservice = allservices != "" ? allservices.length : 0;

        res.send({admin_role: req.user.admin_role, allservices, totservice, sitecom: services.sitecom, usercom: services.usercom});
    } catch (error) {
        console.log(error);
    }
});

router.post("/dcommreport", auth, async(req, res)=>{
    try {
        let { start, end, sitter } = req.body;

        let where = '';
        if (req.user.admin_role != "1") {
            sitter = req.user.admin_id;
            where = `WHERE ord.sitter_id = "${req.user.admin_id}" `;
        }

        let services = "";
        if ( start || end || sitter ) {
            services = await commissionQuery(start, end, sitter);
        } else {
            services = await scommissionservices(where);
        }

        services.map(sd => {
            if (req.user.admin_role != "1") sd.tot_price = (parseFloat(sd.tot_price) - parseFloat(sd.csite)).toFixed(2);
            return sd;
        });

        if (services != "") {
            let xlsxdata = [["Service Id", "Sitter Commission", "Customer Commission", "Price", "Date", "Customer Name", "Sitter Name"]];
            services.forEach(sdata => {
                let data = [sdata.order_id, sdata.csite, sdata.csitter, sdata.tot_price, sdata.date, sdata.cus_name, sdata.sitt_name];
                xlsxdata.push(data);
            });

            if (xlsxdata.length > 0) {
                downloadFile(xlsxdata, 'Commission', 'Commission', res);
            }
        }
        
    } catch (error) {
        console.log(error);
    }
});





async function docrtotalpayour(where) {
    const payout = await DataFind(`SELECT dpa.amount, dpa.date, dpa.p_type, dpa.p_status, dpa.p_status, COALESCE(doc.name) AS user_name, COALESCE(doc.email) AS user_email
                                    FROM tbl_doctor_payout_adjust AS dpa
                                    JOIN tbl_doctor_list AS doc ON dpa.doctor_id = doc.id
                                    WHERE dpa.status = '2' ${where} ORDER BY dpa.id DESC`);

    return payout;
}

async function medirtotalpayour(where) {
    const payout = await DataFind(`SELECT ppa.amount, ppa.date, ppa.p_type, ppa.p_status, ppa.p_status, COALESCE(doc.name) AS user_name, COALESCE(doc.email) AS user_email
                                    FROM tbl_doctor_product_payout_adjust AS ppa
                                    JOIN tbl_doctor_list AS doc ON ppa.doctor_id = doc.id
                                    WHERE ppa.status = '2' ${where} ORDER BY ppa.id DESC`);

    return payout;
}

async function labrtotalpayour(where) {
    const payout = await DataFind(`SELECT lap.amount, lap.date, lap.p_type, lap.p_status, lap.p_status, COALESCE(lab.name) AS user_name, COALESCE(lab.email) AS user_email
                                    FROM tbl_lab_payout_adjust AS lap
                                    JOIN tbl_lab_list AS lab ON lap.lab_id = lab.id
                                    WHERE lap.status = '2' ${where} ORDER BY lap.id DESC`);

    return payout;
}

async function PayoutQuery(sitter, start, end, status, role) {
    let services = [], where = "", duid = '', ddate = '', dstatus = '';

    if (role == 1) {
        duid = 'dpa.doctor_id'; ddate = 'dpa.date'; dstatus = 'dpa.p_status';
    } else if (role == 2) {
        duid = 'ppa.doctor_id'; ddate = 'ppa.date'; dstatus = 'ppa.p_status';
    } else if (role == 3) {
        duid = 'lap.lab_id'; ddate = `lap.date`; dstatus = 'lap.p_status';
    }

    if (sitter && start && end && status) {
        where = `AND ${duid} = "${sitter}" AND ${ddate} >= "${start}" AND ${ddate} <= "${end}" AND ${dstatus} = "${status}"`;

    } else if(sitter && start && end) {
        where = `AND ${duid} = "${sitter}" AND ${ddate} >= "${start}" AND ${ddate} <= "${end}"`;

    } else if(sitter && end && status ) {
        where = `AND ${duid} = "${sitter}" AND ${ddate} <= "${end}" AND ${dstatus} = "${status}"`;

    } else if(sitter && start && status ) {
        where = `AND ${duid} = "${sitter}" AND ${ddate} >= "${start}" AND ${dstatus} = "${status}"`;

    } else if(start && end && status) {
        where = `AND ${ddate} >= "${start}" AND ${ddate} <= "${end}" AND ${dstatus} = "${status}"`;

    } else if(sitter && start ) {
        where = `AND ${duid} = "${sitter}" AND ${ddate} >= "${start}"`;

    } else if(sitter && end) {
        where = `AND ${duid} = "${sitter}" AND ${ddate} <= "${end}"`;

    } else if(sitter && status) {
        where = `AND ${duid} = "${sitter}" AND ${dstatus} = "${status}"`;

    } else if(start && end) {
        where = `AND ${ddate} >= "${start}" AND ${ddate} <= "${end}"`;

    } else if(start && status) {
        where = `AND ${ddate} >= "${start}" AND ${dstatus} = "${status}"`;

    } else if(end && status) {
        where = `AND ${ddate} <= "${end}" AND ${dstatus} = "${status}"`;

    } else if(sitter) {
        where = `AND ${duid} = "${sitter}" `;

    } else if(start) {
        where = `AND ${ddate} >= "${start}"`;

    } else if(end) {
        where = `AND ${ddate} <= "${end}"`;

    } else if (status) {
        where = `AND ${dstatus} = "${status}"`;
    }

    if (role == 1) services = await docrtotalpayour(where);
    else if (role == 2) services = await medirtotalpayour(where);
    else if (role == 3) services = await labrtotalpayour(where);

    return services;
}

router.get("/payout/:id", auth, async(req, res)=>{
    try {
        let role = req.params.id, user_list = [], where = "", allservices = [], sitecom = 0, usercom = 0;

        if (role == 1 || role == 2) {
            user_list = await DataFind(`SELECT id, name FROM tbl_doctor_list 
                                        WHERE status = '1' AND logo NOT IN ("") AND name NOT IN ("") AND email NOT IN ("") AND title NOT IN ("") AND address NOT IN ("") AND latitude NOT IN (0) 
                                        AND longitude NOT IN (0)
                                        ORDER BY id DESC`);
            
            if (role == 1) {
                if (req.user.admin_role != "1") where = `AND dpa.doctor_id = "${req.user.admin_id}"`;
                
                allservices = await docrtotalpayour(where);

            } else if (role == 2) {
                if (req.user.admin_role != "1") where = `AND ppa.doctor_id = "${req.user.admin_id}"`;

                allservices = await medirtotalpayour(where);
            }
            
        } else {
            user_list = await DataFind(`SELECT id, name FROM tbl_lab_list WHERE status = '1' ORDER BY id DESC`);
            
            if (req.user.admin_role != "1") where = `AND lap.lab_id = "${req.user.admin_id}"`;

            allservices = await labrtotalpayour(where);

        }

        allservices.map(av => {
            av.date = AllFunction.NotificationDate(av.date);

            if (av.p_status == "0") sitecom += Number(av.amount);
            if (av.p_status == "1") usercom += Number(av.amount);
        });

        let ptotal = allservices != "" ? allservices.length : 0;
        
        res.render("report_payout", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, user_list, allservices, ptotal, sitecom, usercom, role
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/payout_data", auth, async(req, res)=>{
    try {
        let {sitter, start, end, status, role} = req.body;

        if (req.user.admin_role != "1") sitter = req.user.admin_id;

        let allservices = [], sitecom = 0, usercom = 0;
        if (sitter || start || end || status || role) {
            allservices = await PayoutQuery(sitter, start, end, status, role);
        } else {
            if (role == 1) services = await docrtotalpayour(`AND dpa.doctor_id = "${req.user.admin_id}" `);
            else if (role == 2) services = await medirtotalpayour(`AND ppa.doctor_id = "${req.user.admin_id}" `);
            else if (role == 3) services = await labrtotalpayour(`AND lap.lab_id = "${req.user.admin_id}" `);
        }
        
        allservices.map(av => {
            av.date = AllFunction.NotificationDate(av.date);

            if (av.p_status == "0") sitecom += Number(av.amount);
            if (av.p_status == "1") usercom += Number(av.amount);
            
        });

        let ptotal = allservices.length > 0 ? allservices.length : 0;

        res.send({ allservices, ptotal, sitecom, usercom });
    } catch (error) {
        console.log(error);
    }
});

router.post("/dpayout", auth, async(req, res)=>{
    try {
        let { sitter, start, end, status } = req.body;

        if (req.user.admin_role != "1") sitter = req.user.admin_id;

        let pdata = "";
        if (sitter || start || end || status) {
            pdata = await PayoutQuery(sitter, start, end, status);
            
        } else {
            let where = "";
            pdata = await rtotalpayour(where);
        }

        let payout = pdata.map(pval => {

            let ptype = "1";
            if (pval.p_type == "1") ptype = "UPI";
            if (pval.p_type == "2") ptype = "Paypal";
            if (pval.p_type == "3") ptype = "Bank Transfer";
            
            let sta = "";
            if (pval.status == "1") sta = "Complete";
            if (pval.status == "0") sta = "Pending";

            pval.p_type = ptype;
            pval.status = sta;
            return pval;
        });

        if (pdata != "") {
            let xlsxdata = [["Date", "Amount", "Email", "Payout Type", "Status"]];
            payout.forEach(pdata => {
                let data = [pdata.date, pdata.amount, pdata.aemail, pdata.p_type, pdata.status];
                xlsxdata.push(data);
            });

            if (xlsxdata.length > 0) {
                downloadFile(xlsxdata, 'Payout', 'Payout', res);
            }
        }
        
    } catch (error) {
        console.log(error);
    }
});



module.exports = router;