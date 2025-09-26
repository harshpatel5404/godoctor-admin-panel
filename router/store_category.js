/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const multer  = require('multer');
let mysql = require('mysql2');
const AllFunction = require("../route_function/function");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");



AllFunction.ImageUploadFolderCheck(`./public/uploads/store_category`);
const storage1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/store_category");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const store_category = multer({storage : storage1});

// ============= Store category ================ //

router.get("/add", auth, async(req, res)=>{
    try {

        res.render("add_store_category", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});  // uploads/sub_banner/store_b1.jpg&!!uploads/sub_banner/store_b2.jpg&!!uploads/sub_banner/store_b3.jpg

router.post("/add_scategory_data", auth, store_category.single('image'), async(req, res)=>{
    try {
        const {name, status} = req.body;

        const imageUrl = req.file ? "uploads/store_category/" + req.file.filename : null;
        let esname = mysql.escape(name), statuss = status == "on" ? 1 : 0;

        if (await DataInsert(`tbl_store_category`, `image, name, status`, `'${imageUrl}', ${esname}, '${statuss}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Store category Add successfully');
        res.redirect("/store_category/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})

router.get("/list", auth, async(req, res)=>{
    try {
        const scategory_list = await DataFind(`SELECT * FROM tbl_store_category ORDER BY id DESC`);

        res.render("list_store_category", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, scategory_list
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/edit/:id", auth, async(req, res)=>{
    try {
        const scategory = await DataFind(`SELECT * FROM tbl_store_category WHERE id = '${req.params.id}'`);
        
        res.render("edit_store_category", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, scategory:scategory[0]
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_department_data/:id", auth, store_category.single('image'), async(req, res)=>{
    try {
        const {name, status} = req.body;

        let esname = mysql.escape(name), imageUrl = null, statuss = status == "on" ? 1 : 0;

        const scategory = await DataFind(`SELECT * FROM tbl_store_category WHERE id = '${req.params.id}'`);

        if (scategory[0].name != name) {
            const scname = await DataFind(`SELECT * FROM tbl_store_category WHERE name = '${name}'`);
            if (scname != '') {
                req.flash('errors', `This Name Already Added!`);
                return res.redirect("back");
            }
        }

        if (req.file) {
            await AllFunction.DeleteImage(scategory[0].image);
            imageUrl = "uploads/store_category/" + req.file.filename;
        } else imageUrl = scategory[0].image;
        
        if (await DataUpdate(`tbl_store_category`, `image = '${imageUrl}', name = ${esname}, status = '${statuss}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Store category Updated successfully');
        res.redirect("/store_category/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        const department = await DataFind(`SELECT * FROM tbl_store_category WHERE id = '${req.params.id}'`);

        await AllFunction.DeleteImage(department[0].image);
        
        if (await DataDelete(`tbl_store_category`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Store category Deleted successfully');
        res.redirect("/store_category/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})





module.exports = router;