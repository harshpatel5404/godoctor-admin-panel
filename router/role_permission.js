/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const countryCodes = require('country-codes-list');
const bcrypt = require('bcrypt');
const auth = require("../middleware/auth");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");



router.get("/add", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        
        res.render("add_role_permission", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/detail_check", auth, async(req, res)=>{
    try {
        const { email, country, phone } = req.body;

        console.log(req.body);
        
        let check_email = true, check_mobileno = true;

        if (email != '') {
            const emailExists = await DataFind(`SELECT email FROM tbl_doctor_list WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_lab_list WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_role_permission WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_admin WHERE email = '${email}'`);

            if (emailExists != '') check_email = false;
            else  check_email = true;
        }

        if (country != '' && phone != '') {
            const phoneExists = await DataFind(`SELECT phone FROM tbl_doctor_list WHERE country_code = '${country}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_lab_list WHERE country_code = '${country}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_doctor_receptionist WHERE country_code = '${country}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_role_permission WHERE country_code = '${country}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_admin WHERE country_code = '${country}' AND phone = '${phone}'`);

            if (phoneExists != '') check_mobileno = false;
            else  check_mobileno = true;
        }

        res.send({check_email, check_mobileno});
    } catch (error) {
        console.log(error);
        res.send({check_email: 2, check_mobileno: 2});
    }
});

router.post("/add_role", auth, async(req, res)=>{
    try {
        const { name, email, country_code, phone, status, password, docbookview, labbookview, medibookview, patiview, patiadd, patiedit, depaview, depaadd, depaedit, scateview, scateadd, 
            scateedit, hosview, hosadd, hosedit, docview, docadd, docedit, labview, labadd, labedit, labbanview, labbanadd, labbanedit, labcateview, labcateadd, labcateedit, 
            bloodview, bloodadd, bloodedit, relaview, relaadd, relaedit, docrepview, medirepview, labrepview, dynsview, dynsadd, dynsedit, docpayview, docpayedit, medipview, 
            medipedit, labpayview, labpayedit, doccmanview, doccmanedit, labcmanview, labcmanedit, paylview, payledit, bannerview, banneradd, banneredit, cityview, cityadd, 
            cityedit, senotiview, senotiadd, senotiedit, faqview, faqadd, faqedit, canreasview, canreasadd, canreasedit, pageview, pageedit, settingview, settingedit
        } = req.body;

        const docbook = docbookview == "on" ? "1" : "0";

        const labbook = labbookview == "on" ? "1" : "0";

        const medibook = medibookview == "on" ? "1" : "0";
        
        let pati1 = patiview == "on" ? "1" : "0";
        let pati2 = patiadd == "on" ? "1" : "0";
        let pati3 = patiedit == "on" ? "1" : "0";
        const pati = pati1 + ',' + pati2 + ',' + pati3;
        
        let depa1 = depaview == "on" ? "1" : "0";
        let depa2 = depaadd == "on" ? "1" : "0";
        let depa3 = depaedit == "on" ? "1" : "0";
        const depa = depa1 + ',' + depa2 + ',' + depa3;
        
        let scate1 = scateview == "on" ? "1" : "0";
        let scate2 = scateadd == "on" ? "1" : "0";
        let scate3 = scateedit == "on" ? "1" : "0";
        const scate = scate1 + ',' + scate2 + ',' + scate3;
        
        let hos1 = hosview == "on" ? "1" : "0";
        let hos2 = hosadd == "on" ? "1" : "0";
        let hos3 = hosedit == "on" ? "1" : "0";
        const hos = hos1 + ',' + hos2 + ',' + hos3;
        
        let doc1 = docview == "on" ? "1" : "0";
        let doc2 = docadd == "on" ? "1" : "0";
        let doc3 = docedit == "on" ? "1" : "0";
        const doc = doc1 + ',' + doc2 + ',' + doc3;
        
        let lab1 = labview == "on" ? "1" : "0";
        let lab2 = labadd == "on" ? "1" : "0";
        let lab3 = labedit == "on" ? "1" : "0";
        const lab = lab1 + ',' + lab2 + ',' + lab3;
        
        let labban1 = labbanview == "on" ? "1" : "0";
        let labban2 = labbanadd == "on" ? "1" : "0";
        let labban3 = labbanedit == "on" ? "1" : "0";
        const labban = labban1 + ',' + labban2 + ',' + labban3;
        
        let labcate1 = labcateview == "on" ? "1" : "0";
        let labcate2 = labcateadd == "on" ? "1" : "0";
        let labcate3 = labcateedit == "on" ? "1" : "0";
        const labcate = labcate1 + ',' + labcate2 + ',' + labcate3;
        
        let blood1 = bloodview == "on" ? "1" : "0";
        let blood2 = bloodadd == "on" ? "1" : "0";
        let blood3 = bloodedit == "on" ? "1" : "0";
        const blood = blood1 + ',' + blood2 + ',' + blood3;
        
        let rela1 = relaview == "on" ? "1" : "0";
        let rela2 = relaadd == "on" ? "1" : "0";
        let rela3 = relaedit == "on" ? "1" : "0";
        const rela = rela1 + ',' + rela2 + ',' + rela3;

        const docrep = docrepview == "on" ? "1" : "0";

        const medirep = medirepview == "on" ? "1" : "0";

        const labrep = labrepview == "on" ? "1" : "0";

        let dyns1 = dynsview == "on" ? "1" : "0";
        let dyns2 = dynsadd == "on" ? "1" : "0";
        let dyns3 = dynsedit == "on" ? "1" : "0";
        const dyns = dyns1 + ',' + dyns2 + ',' + dyns3;
        
        let docpay1 = docpayview == "on" ? "1" : "0";
        let docpay3 = docpayedit == "on" ? "1" : "0";
        const docpay = docpay1 + ',' + docpay3;
        
        let medip1 = medipview == "on" ? "1" : "0";
        let medip3 = medipedit == "on" ? "1" : "0";
        const medip = medip1 + ',' + medip3;
        
        let labpay1 = labpayview == "on" ? "1" : "0";
        let labpay3 = labpayedit == "on" ? "1" : "0";
        const labpay = labpay1 + ',' + labpay3;
        
        let doccman1 = doccmanview == "on" ? "1" : "0";
        let doccman3 = doccmanedit == "on" ? "1" : "0";
        const doccman = doccman1 + ',' + doccman3;
        
        let labcman1 = labcmanview == "on" ? "1" : "0";
        let labcman3 = labcmanedit == "on" ? "1" : "0";
        const labcman = labcman1 + ',' + labcman3;
        
        let payl1 = paylview == "on" ? "1" : "0";
        let payl3 = payledit == "on" ? "1" : "0";
        const payl = payl1 + ',' + payl3;

        let banner1 = bannerview == "on" ? "1" : "0";
        let banner2 = banneradd == "on" ? "1" : "0";
        let banner3 = banneredit == "on" ? "1" : "0";
        const banner = banner1 + ',' + banner2 + ',' + banner3;

        let city1 = cityview == "on" ? "1" : "0";
        let city2 = cityadd == "on" ? "1" : "0";
        let city3 = cityedit == "on" ? "1" : "0";
        const city = city1 + ',' + city2 + ',' + city3;

        let senoti1 = senotiview == "on" ? "1" : "0";
        let senoti2 = senotiadd == "on" ? "1" : "0";
        let senoti3 = senotiedit == "on" ? "1" : "0";
        const senoti = senoti1 + ',' + senoti2 + ',' + senoti3;

        let faq1 = faqview == "on" ? "1" : "0";
        let faq2 = faqadd == "on" ? "1" : "0";
        let faq3 = faqedit == "on" ? "1" : "0";
        const faq = faq1 + ',' + faq2 + ',' + faq3;

        let canreas1 = canreasview == "on" ? "1" : "0";
        let canreas2 = canreasadd == "on" ? "1" : "0";
        let canreas3 = canreasedit == "on" ? "1" : "0";
        const canreas = canreas1 + ',' + canreas2 + ',' + canreas3;
        
        let page1 = pageview == "on" ? "1" : "0";
        let page3 = pageedit == "on" ? "1" : "0";
        const page = page1 + ',' + page3;
        
        let setting1 = settingview == "on" ? "1" : "0";
        let setting3 = settingedit == "on" ? "1" : "0";
        const setting = setting1 + ',' + setting3;
        
        const phash = await bcrypt.hash(password, 10);
        
        if (await DataInsert(`tbl_role_permission`,
            `name, email, country_code, phone, status, password, doc_booking, lab_booking, medi_booking, patient, department, store_category, hospital, doctor, lab, lab_banner, 
            lab_category, blood_group, relationship, doctor_report, medi_report, lab_report, dyna_section, doctor_payout, medicine_payout, lab_payout, doc_cash_man, lab_cash_manage, 
            payment, banner, city, send_notifi, faq, can_reason, pages, setting`,
            `'${name}', '${email}', '${country_code}', '${phone}', '${status}', '${phash}', '${docbook}', '${labbook}', '${medibook}', '${pati}', '${depa}', '${scate}', '${hos}', 
            '${doc}', '${lab}', '${labban}', '${labcate}', '${blood}', '${rela}', '${docrep}', '${medirep}', '${labrep}', '${dyns}', '${docpay}', '${medip}', '${labpay}', '${doccman}', 
            '${labcman}', '${payl}', '${banner}', '${city}', '${senoti}', '${faq}', '${canreas}', '${page}', '${setting}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Role Add successfully');
        res.redirect("/role/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



router.get("/list", auth, async(req, res)=>{
    try {
        const role_data = await DataFind(`SELECT id, name, email, country_code, phone, status FROM tbl_role_permission ORDER BY id DESC`);
        // console.log(role_data);

        res.render("list_role_permission", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, role_data
        });
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

        const role_data = await DataFind(`SELECT * FROM tbl_role_permission WHERE id = '${req.params.id}'`);
        // console.log(role_data);
        
        let index = 0;
        let role = Object.keys(role_data[0]).reduce((key, i) => {
            let rval = role_data[0][i];
            
            if (index > 6) rval = rval.split(",");
            key[i] = rval;
            index++;
            return key;
        }, {});

        

        res.render("edit_role_permission", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode, role
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_role/:id", auth, async(req, res)=>{
    try {
        const { name, email, country_code, phone, status, password, docbookview, labbookview, medibookview, patiview, patiadd, patiedit, depaview, depaadd, depaedit, scateview, 
            scateadd, scateedit, hosview, hosadd, hosedit, docview, docadd, docedit, labview, labadd, labedit, labbanview, labbanadd, labbanedit, labcateview, labcateadd, labcateedit, 
            bloodview, bloodadd, bloodedit, relaview, relaadd, relaedit, docrepview, medirepview, labrepview, dynsview, dynsadd, dynsedit, docpayview, docpayedit, medipview, 
            medipedit, labpayview, labpayedit, doccmanview, doccmanedit, labcmanview, labcmanedit, paylview, payledit, bannerview, banneradd, banneredit, cityview, cityadd, 
            cityedit, senotiview, senotiadd, senotiedit, faqview, faqadd, faqedit, canreasview, canreasadd, canreasedit, pageview, pageedit, settingview, settingedit
        } = req.body;

        const role_data = await DataFind(`SELECT id, password, country_code, phone FROM tbl_role_permission WHERE id = "${req.params.id}"`);
        if(role_data == '') {
            req.flash('errors', `Data Not Found`);
            return res.redirect("back");
        }

        const docbook = docbookview == "on" ? "1" : "0";

        const labbook = labbookview == "on" ? "1" : "0";

        const medibook = medibookview == "on" ? "1" : "0";
        
        let pati1 = patiview == "on" ? "1" : "0";
        let pati2 = patiadd == "on" ? "1" : "0";
        let pati3 = patiedit == "on" ? "1" : "0";
        const pati = pati1 + ',' + pati2 + ',' + pati3;
        
        let depa1 = depaview == "on" ? "1" : "0";
        let depa2 = depaadd == "on" ? "1" : "0";
        let depa3 = depaedit == "on" ? "1" : "0";
        const depa = depa1 + ',' + depa2 + ',' + depa3;
        
        let scate1 = scateview == "on" ? "1" : "0";
        let scate2 = scateadd == "on" ? "1" : "0";
        let scate3 = scateedit == "on" ? "1" : "0";
        const scate = scate1 + ',' + scate2 + ',' + scate3;
        
        let hos1 = hosview == "on" ? "1" : "0";
        let hos2 = hosadd == "on" ? "1" : "0";
        let hos3 = hosedit == "on" ? "1" : "0";
        const hos = hos1 + ',' + hos2 + ',' + hos3;
        
        let doc1 = docview == "on" ? "1" : "0";
        let doc2 = docadd == "on" ? "1" : "0";
        let doc3 = docedit == "on" ? "1" : "0";
        const doc = doc1 + ',' + doc2 + ',' + doc3;
        
        let lab1 = labview == "on" ? "1" : "0";
        let lab2 = labadd == "on" ? "1" : "0";
        let lab3 = labedit == "on" ? "1" : "0";
        const lab = lab1 + ',' + lab2 + ',' + lab3;
        
        let labban1 = labbanview == "on" ? "1" : "0";
        let labban2 = labbanadd == "on" ? "1" : "0";
        let labban3 = labbanedit == "on" ? "1" : "0";
        const labban = labban1 + ',' + labban2 + ',' + labban3;
        
        let labcate1 = labcateview == "on" ? "1" : "0";
        let labcate2 = labcateadd == "on" ? "1" : "0";
        let labcate3 = labcateedit == "on" ? "1" : "0";
        const labcate = labcate1 + ',' + labcate2 + ',' + labcate3;
        
        let blood1 = bloodview == "on" ? "1" : "0";
        let blood2 = bloodadd == "on" ? "1" : "0";
        let blood3 = bloodedit == "on" ? "1" : "0";
        const blood = blood1 + ',' + blood2 + ',' + blood3;
        
        let rela1 = relaview == "on" ? "1" : "0";
        let rela2 = relaadd == "on" ? "1" : "0";
        let rela3 = relaedit == "on" ? "1" : "0";
        const rela = rela1 + ',' + rela2 + ',' + rela3;

        const docrep = docrepview == "on" ? "1" : "0";

        const medirep = medirepview == "on" ? "1" : "0";

        const labrep = labrepview == "on" ? "1" : "0";

        let dyns1 = dynsview == "on" ? "1" : "0";
        let dyns2 = dynsadd == "on" ? "1" : "0";
        let dyns3 = dynsedit == "on" ? "1" : "0";
        const dyns = dyns1 + ',' + dyns2 + ',' + dyns3;
        
        let docpay1 = docpayview == "on" ? "1" : "0";
        let docpay3 = docpayedit == "on" ? "1" : "0";
        const docpay = docpay1 + ',' + docpay3;
        
        let medip1 = medipview == "on" ? "1" : "0";
        let medip3 = medipedit == "on" ? "1" : "0";
        const medip = medip1 + ',' + medip3;
        
        let labpay1 = labpayview == "on" ? "1" : "0";
        let labpay3 = labpayedit == "on" ? "1" : "0";
        const labpay = labpay1 + ',' + labpay3;
        
        let doccman1 = doccmanview == "on" ? "1" : "0";
        let doccman3 = doccmanedit == "on" ? "1" : "0";
        const doccman = doccman1 + ',' + doccman3;
        
        let labcman1 = labcmanview == "on" ? "1" : "0";
        let labcman3 = labcmanedit == "on" ? "1" : "0";
        const labcman = labcman1 + ',' + labcman3;
        
        let payl1 = paylview == "on" ? "1" : "0";
        let payl3 = payledit == "on" ? "1" : "0";
        const payl = payl1 + ',' + payl3;

        let banner1 = bannerview == "on" ? "1" : "0";
        let banner2 = banneradd == "on" ? "1" : "0";
        let banner3 = banneredit == "on" ? "1" : "0";
        const banner = banner1 + ',' + banner2 + ',' + banner3;

        let city1 = cityview == "on" ? "1" : "0";
        let city2 = cityadd == "on" ? "1" : "0";
        let city3 = cityedit == "on" ? "1" : "0";
        const city = city1 + ',' + city2 + ',' + city3;

        let senoti1 = senotiview == "on" ? "1" : "0";
        let senoti2 = senotiadd == "on" ? "1" : "0";
        let senoti3 = senotiedit == "on" ? "1" : "0";
        const senoti = senoti1 + ',' + senoti2 + ',' + senoti3;

        let faq1 = faqview == "on" ? "1" : "0";
        let faq2 = faqadd == "on" ? "1" : "0";
        let faq3 = faqedit == "on" ? "1" : "0";
        const faq = faq1 + ',' + faq2 + ',' + faq3;

        let canreas1 = canreasview == "on" ? "1" : "0";
        let canreas2 = canreasadd == "on" ? "1" : "0";
        let canreas3 = canreasedit == "on" ? "1" : "0";
        const canreas = canreas1 + ',' + canreas2 + ',' + canreas3;
        
        let page1 = pageview == "on" ? "1" : "0";
        let page3 = pageedit == "on" ? "1" : "0";
        const page = page1 + ',' + page3;
        
        let setting1 = settingview == "on" ? "1" : "0";
        let setting3 = settingedit == "on" ? "1" : "0";
        const setting = setting1 + ',' + setting3;
        
        const phash = password != '' ? await bcrypt.hash(password, 10) : role_data[0].password;
        
        if (await DataUpdate(`tbl_role_permission`, `name = '${name}', email = '${email}', country_code = '${country_code}', phone = '${phone}', status = '${status}', 
            password = '${phash}', doc_booking = '${docbook}', lab_booking = '${labbook}', medi_booking = '${medibook}', patient = '${pati}', department = '${depa}', 
            store_category = '${scate}', hospital = '${hos}', doctor = '${doc}', lab = '${lab}', lab_banner = '${labban}', lab_category = '${labcate}', blood_group = '${blood}', 
            relationship = '${rela}', doctor_report = '${docrep}', medi_report = '${medirep}', lab_report = '${labrep}', dyna_section = '${dyns}', doctor_payout = '${docpay}', 
            medicine_payout = '${medip}', lab_payout = '${labpay}', doc_cash_man = '${doccman}', lab_cash_manage = '${labcman}', payment = '${payl}', banner = '${banner}', 
            city = '${city}', send_notifi = '${senoti}', faq = '${faq}', can_reason = '${canreas}', pages = '${page}', setting = '${setting}'`,
            `id = '${role_data[0].id}'`, req.hostname, req.protocol) == -1) {
            
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Role Updated successfully');
        res.redirect("/role/edit/5");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        const role_data = await DataFind(`SELECT id FROM tbl_role_permission WHERE id = "${req.params.id}"`);
        console.log(role_data);
        
        if (role_data != '') {
            if (await DataDelete(`tbl_role_permission`, `id = '${role_data[0].id}'`, req.hostname, req.protocol) == -1) {
            
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            req.flash('success', 'Services Deleted successfully');
            
        } else req.flash('errors', `Data Not Found`);

        res.redirect("/role/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



module.exports = router;