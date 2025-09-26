/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */

const express = require("express");
const router = express.Router();
const multer  = require('multer');
const auth = require("../middleware/auth");
const AllFunction = require("../route_function/function");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");

const cusImage = `./public/uploads/category`;
AllFunction.ImageUploadFolderCheck(cusImage);
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/category");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const upload = multer({storage : storage});

// ============= Category ================ //

router.get("/add", auth, async(req, res)=>{
    try {
        
        res.render("add_blood_group", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_data", auth, async(req, res)=>{
    try {
        const {name, status} = req.body;

        const sttauss = status == "on" ? 1 : 0;
        if (await DataInsert( `tbl_blood_group`, `name, status`, `'${name}', '${sttauss}'`, req.hostname, req.protocol) == -1) {
            
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Blood group Added successfully');
        res.redirect("/category/view");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/view", auth, async(req, res)=>{
    try {
        const category_data = await DataFind(`SELECT * FROM tbl_blood_group`);

        res.render("list_blood_group", {
            auth:req.user, category_data, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/edit/:id", auth, auth, async(req, res)=>{
    try {
        const category_data = await DataFind(`SELECT * FROM tbl_blood_group WHERE id = '${req.params.id}'`);
        
        res.render("edit_blood_group", {
            auth:req.user, category_data, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_data/:id", auth, async(req, res)=>{
    try {
        const {name, status} = req.body;
        
        const sttauss = status == "on" ? 1 : 0;
        if (await DataUpdate(`tbl_blood_group`, `name = '${name}', status = '${sttauss}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Blood group Updated successfully');
        res.redirect("/category/view");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_blood_group`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Blood group Deleted successfully');
        res.redirect("/category/view");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Relationship ================ //

router.get("/add_relationship", auth, async(req, res)=>{
    try {
        
        res.render("add_relationship", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_relationship_data", auth, async(req, res)=>{
    try {
        const {name, status} = req.body;

        const sttauss = status == "on" ? 1 : 0;
        if (await DataInsert( `tbl_relationship`, `name, status`, `'${name}', '${sttauss}'`, req.hostname, req.protocol) == -1) {
            
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Relationship Added successfully');
        res.redirect("/category/relationship_list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/relationship_list", auth, async(req, res)=>{
    try {
        const category_data = await DataFind(`SELECT * FROM tbl_relationship`);

        res.render("list_relationship", {
            auth:req.user, category_data, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/edit_relationship/:id", auth, auth, async(req, res)=>{
    try {
        const relationship = await DataFind(`SELECT * FROM tbl_relationship WHERE id = '${req.params.id}'`);
        
        res.render("edit_relationship", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, relationship
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_relationship_data/:id", auth, async(req, res)=>{
    try {
        const {name, status} = req.body;
            
        const sttauss = status == "on" ? 1 : 0;
        if (await DataUpdate(`tbl_relationship`, `name = '${name}', status = '${sttauss}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Relationship Updated successfully');
        res.redirect("/category/relationship_list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete_relationship/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_relationship`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Relationship Deleted successfully');
        res.redirect("/category/relationship_list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Breed ================ //

router.get("/pet_size", auth, async(req, res)=>{
    try {
        const pet_size = await DataFind(`SELECT * FROM tbl_pet_size`);

        res.render("pet_size", {
            auth:req.user, pet_size, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_size", auth, async(req, res)=>{
    try {
        const {name, min_size, max_size, units} = req.body;

        if (await DataInsert(`tbl_pet_size`, `name, min_size, max_size, units`, `'${name}', '${min_size}', '${max_size}', '${units}'`, req.hostname, req.protocol) == -1) {
            
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Pet Size Added successfully');
        res.redirect("/category/pet_size");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_pet_size/:id", auth, async(req, res)=>{
    try {
        const {name, min_size, max_size, units} = req.body;

        if (await DataUpdate(`tbl_pet_size`, `name = '${name}', min_size = '${min_size}', max_size = '${max_size}', units = '${units}'`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {

            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Pet Size Updated successfully');
        res.redirect("/category/pet_size");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete_prt_size/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_pet_size`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
            
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Pet Size Deleted successfully');
        res.redirect("/category/pet_size");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Breed ================ //

router.get("/pet_age", auth, async(req, res)=>{
    try {
        const pet_year = await DataFind(`SELECT * FROM tbl_pet_year`);

        res.render("pet_age", {
            auth:req.user, pet_year, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_age", auth, async(req, res)=>{
    try {
        const {name, min_year, max_year, units} = req.body;

        if (await DataInsert(`tbl_pet_year`,
            `name, min_year, max_year, units`,
            `'${name}', '${min_year}', '${max_year}', '${units}'`, req.hostname, req.protocol) == -1) {

            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Pet Year Added successfully');
        res.redirect("/category/pet_age");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_pet_year/:id", auth, async(req, res)=>{
    try {
        const {name, min_year, max_year, units} = req.body;

        if (await DataUpdate(`tbl_pet_year`, `name = '${name}', min_year = '${min_year}', max_year = '${max_year}', units = '${units}'`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {

            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Pet Year Updated successfully');
        res.redirect("/category/pet_age");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete_prt_age/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_pet_year`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            res.redirect("/valid_license");
        } else {
            req.flash('success', 'Pet Year Deleted successfully');
            res.redirect("/category/pet_age");
        }
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});





module.exports = router;