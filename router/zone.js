/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
let mysql = require('mysql2');
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");



// ============= Zone ================ //

router.get("/add", auth, async(req, res)=>{
    try {

        res.render("add_zone", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_zone_data", auth, async(req, res)=>{
    try {
        const {name, status, zone_lat_lon} = req.body;

       
        let esname = mysql.escape(name), lat_log = [], polygone = [];
        const all_lat_lon = zone_lat_lon.split(',').map(Number); // Input is: [lat, lon, lat, lon, ...]

        if (all_lat_lon.length % 2 !== 0) {
            console.error("❌ Invalid coordinate pair count.");
            req.flash('errors', `❌ Invalid coordinate pair count.`);
            return;
        }

        for (let i = 0; i < all_lat_lon.length; i += 2) {
            const lat = all_lat_lon[i];       // latitude first ✅
            const lon = all_lat_lon[i + 1];   // then longitude ✅
        
            if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
                req.flash('errors', `❌ Skipped invalid lat/lon pair: lat=${lat}, lon=${lon}`);
                console.error(`❌ Skipped invalid lat/lon pair: lat=${lat}, lon=${lon}`);
                continue;
            }
      
            lat_log.push({ latitude: lat, longitiude: lon });
            polygone.push(`${lat} ${lon}`);
        }

        if (polygone.length < 3) {
            req.flash('errors', `❌ Not enough valid points.`);
            console.error("❌ Not enough valid points to form a polygon (min 3 + closing point)");
            return;
        }

        if (polygone[0] !== polygone[polygone.length - 1]) {
            polygone.push(polygone[0]); // Close the loop
        }

        const polygonWKT = `POLYGON((${polygone.join(', ')}))`;
        
        if (await DataInsert(`tbl_zone`, `name, status, lat_lon, lat_lon_polygon`, `${esname}, '${status}', '${JSON.stringify(lat_log)}', ST_GeomFromText(${mysql.escape(polygonWKT)}, 4326)`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Zone Add successfully');
        res.redirect("/zone/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})

router.get("/list", auth, async(req, res)=>{
    try {
        const zone_list = await DataFind(`SELECT * FROM tbl_zone ORDER BY id DESC`);

        res.render("list_zone", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, zone_list
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/edit/:id", auth, async(req, res)=>{
    try {
        const zone = await DataFind(`SELECT * FROM tbl_zone WHERE id = '${req.params.id}'`);
        if (zone == '') {
            req.flash('errors', `Detail not found!`);
            return res.redirect("back");
        }
        zone[0].lat_lon = JSON.stringify(zone[0].lat_lon);

        res.render("edit_zone", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, zone:zone[0]
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_zone_data/:id", auth, async(req, res)=>{
    try {
        const {name, status, zone_lat_lon} = req.body;
        
        console.log(zone_lat_lon);
        
        const esname = mysql.escape(name)
        if (zone_lat_lon == "") {
            if (await DataUpdate(`tbl_zone`, `name = ${esname}, status = '${status}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
        } else {

            const all_lat_lon = zone_lat_lon.split(',').map(Number); // Input is: [lat, lon, lat, lon, ...]

            let lat_log = [], polygone = [];

            if (all_lat_lon.length % 2 !== 0) {
                req.flash('errors', `❌ Invalid coordinate pair count.`);
                console.error("❌ Invalid coordinate pair count.");
                return;
            }

            for (let i = 0; i < all_lat_lon.length; i += 2) {
                const lat = all_lat_lon[i];       // latitude first ✅
                const lon = all_lat_lon[i + 1];   // then longitude ✅
            
                if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
                    req.flash('errors', `❌ Skipped invalid lat/lon pair: lat=${lat}, lon=${lon}`);
                    console.error(`❌ Skipped invalid lat/lon pair: lat=${lat}, lon=${lon}`);
                    continue;
                }
          
                lat_log.push({ latitude: lat, longitiude: lon });         // Store normal
                polygone.push(`${lat} ${lon}`);  // flipped as workaround
            }

            if (polygone.length < 3) {
                req.flash('errors', `❌ Not enough valid points to form a polygon (min 3 + closing point)`);
                console.error("❌ Not enough valid points to form a polygon (min 3 + closing point)");
                return;
            }

            if (polygone[0] !== polygone[polygone.length - 1]) {
                polygone.push(polygone[0]);
            }

            const polygonWKT = `POLYGON((${polygone.join(', ')}))`;

            const updateSql = ` name = ${mysql.escape(esname)}, status = ${mysql.escape(status)}, lat_lon = ${mysql.escape(JSON.stringify(lat_log))}, 
                                lat_lon_polygon = ST_GeomFromText(${mysql.escape(polygonWKT)}, 4326)`;

            await DataUpdate( `tbl_zone`, updateSql, `id = '${req.params.id}'`, req.hostname, req.protocol );

            
        
        }

        req.flash('success', 'Zone Updated successfully');
        res.redirect("/zone/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_zone`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Zone Deleted successfully');
        res.redirect("/zone/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})





module.exports = router;