/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
let mysql = require('mysql2');
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");



// ============= Dynamic setion ================ //

router.get("/section/add", auth, async(req, res)=>{
    try {

        res.render("add_dynamic_section", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/require_data", auth, async(req, res)=>{
    try {
        const { s } = req.body;
        
        let cl = [];
        if (s == "Hospital") cl = await DataFind(`SELECT id, name FROM tbl_hospital_list WHERE status = '1' ORDER BY id DESC`);
        else if (s == "Doctor") cl = await DataFind(`SELECT id, name FROM tbl_department_list WHERE status = '1' ORDER BY id DESC`);
        else if (s == "Lab") cl = await DataFind(`SELECT id, name FROM tbl_lab_category WHERE status = '1' ORDER BY id DESC`);
        
        return res.send({ cl });
    } catch (error) {
        console.log(error);
        return res.send({ cl:[] });
    }
});

router.post("/add_data", auth, async(req, res)=>{
    try {
        const { name, status, module, category } = req.body;
        
        if (await DataInsert(`tbl_dynamic_section`, `title, module, category, status`,
            `${mysql.escape(name)}, '${module}', '${category}', '${status}'`, req.hostname, req.protocol) == -1) {
                
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Dynamic section add successfully');
        res.redirect("/dynamic/section/list")
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/section/list", auth, async(req, res)=>{
    try {
        const dy_list = await DataFind(`SELECT ds.id, ds.title, ds.module, ds.status, COALESCE(dl.name, '') AS name,
                                        CASE 
                                            WHEN ds.module = 'Doctor' THEN dl.name
                                            WHEN ds.module = 'Lab' THEN lc.name
                                            WHEN ds.module = 'Hospital' THEN hos.name
                                            ELSE ""
                                        END AS name
                                        FROM tbl_dynamic_section AS ds
                                        LEFT JOIN tbl_department_list AS dl ON dl.id = ds.category AND ds.module = "Doctor"
                                        LEFT JOIN tbl_lab_category AS lc ON lc.id = ds.category AND ds.module = "Lab"
                                        LEFT JOIN tbl_hospital_list AS hos ON hos.id = ds.category AND ds.module = "Hospital"
                                        ORDER BY id DESC`);
        
        res.render("list_dynamic_section", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, dy_list
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/section_edit/:id", auth, async(req, res)=>{
    try {
        const dynamic = await DataFind(`SELECT * FROM tbl_dynamic_section WHERE id = '${req.params.id}'`);

        let cl = [];
        if (dynamic[0].module == "Hospital") cl = await DataFind(`SELECT id, name FROM tbl_hospital_list WHERE status = '1' ORDER BY id DESC`);
        if (dynamic[0].module == "Doctor") cl = await DataFind(`SELECT id, name FROM tbl_department_list WHERE status = '1' ORDER BY id DESC`);
        else if (dynamic[0].module == "Lab") cl = await DataFind(`SELECT id, name FROM tbl_lab_category WHERE status = '1' ORDER BY id DESC`);

        res.render("edit_dynamic_section", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, dynamic: dynamic[0], cl
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_data/:id", auth, async(req, res)=>{
    try {
        const { name, status, module, category } = req.body;
        
        const dynamic = await DataFind(`SELECT * FROM tbl_dynamic_section WHERE id = '${req.params.id}'`);

        if (dynamic != '') {
            if (await DataUpdate(`tbl_dynamic_section`, `title = ${mysql.escape(name)}, module = '${module}', category = '${category}', status = '${status}'`,
                `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
            
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            req.flash('success', 'Dynamic section Update successfully');
        } else req.flash('errors', 'Dynamic section Data Not Found!');

        res.redirect("/dynamic/section/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete_section/:id", auth, async(req, res)=>{
    try {
        const dynamic = await DataFind(`SELECT * FROM tbl_dynamic_section WHERE id = '${req.params.id}'`);
        if (dynamic != '') {
            if (await DataDelete(`tbl_dynamic_section`, `id = '${dynamic[0].id}'`, req.hostname, req.protocol) == -1) {

                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            req.flash('success', 'Dynamic section Update successfully');
        } else req.flash('errors', 'Dynamic section Data Not Found!');

        res.redirect("/dynamic/section/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



module.exports = router;