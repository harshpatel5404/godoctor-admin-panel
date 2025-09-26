const jwt = require('jsonwebtoken');
const { DataFind } = require("./database_query");
const langlist = require("../public/language/language.json");

const auth = async(req, res, next) => {
    try {
        


        
        const token = req.cookies.dapp;
        
        if (!token) {
            req.flash("errors", 'Unauthorized acces detected. please log in to proceed.');
            return res.redirect("/");
        }
        
        const decode = await jwt.verify(token, process.env.jwt_key);
        
        if (decode.admin_role == "2") {
            // console.log(decode);
            const role_data = await DataFind(`SELECT * FROM tbl_role_permission WHERE id = '${decode.admin_id}'`);

            let index = 0
            let role = Object.keys(role_data[0]).reduce((key, i) => {
                let rval = role_data[0][i];
                if (index > 6) rval = rval.split(",");
                key[i] = rval;
                index++;
                return key;
            }, {});
            
            // console.log(role);
            
            req.per = role;
            decode.admin_role = 1;
        } else req.per = 1;
        // console.log(decode);
        
        req.user = decode;

        const general_setting = await DataFind(`SELECT * FROM tbl_general_settings`);
        req.general = general_setting[0];

        req.notification = [];

        const lan = req.cookies.dapplan;
        
        if (!lan) {
            req.lan = {ld: langlist.en, lname:language.lan}
        } else {
            let language = await jwt.verify(lan, process.env.jwt_key);
            
            if (language.lang == "en") {
                req.lan = {ld: langlist.en, lname:language.lan}
            } else if(language.lang == "in") {
                req.lan = {ld: langlist.in, lname:language.lan}
            } else if(language.lang == "de") {
                req.lan = {ld: langlist.de, lname:language.lan}
            } else if(language.lang == "pt") {
                req.lan = {ld: langlist.pt, lname:language.lan}
            } else if(language.lang == "es") {
                req.lan = {ld: langlist.es, lname:language.lan}
            } else if(language.lang == "fr") {
                req.lan = {ld: langlist.fr, lname:language.lan}
            } else if(language.lang == "cn") {
                req.lan = {ld: langlist.cn, lname:language.lan}
            } else if(language.lang == "ae") {
                req.lan = {ld: langlist.ae, lname:language.lan}
            }
        }

        next()
    } catch (error) {
        console.log(error);
        req.flash("errors", 'Something Went Wrong.');
        return res.redirect("/");
    }
}

module.exports = auth;