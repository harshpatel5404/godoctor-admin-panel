const pdf = require('html-pdf');
const fs = require('fs-extra');
const { DataFind } = require("../middleware/database_query");
const path = require("path");
const AllFunction = require("../route_function/function");

async function CreateAppointmentPDF(appoint_id, cus_id, family_mem_id) {
    const ag = await DataFind(`SELECT boap.id, boap.customer_id, boap.status, boap.book_date, boap.appointment_date, boap.appointment_time, boap.treatment_time, 
                                COALESCE(gs.light_image, '') AS gslight_image, COALESCE(gs.title, '') AS gslight_title, COALESCE(gs.web_pay_success_url, '') AS web_link, 
                                COALESCE(dep.name, '') AS department_name, COALESCE(dhd.sub_title, '') AS sub_title,

                                COALESCE(cus.name, '') AS cus_name,

                                COALESCE(doc.name, '') AS dname, COALESCE(doc.title, '') AS dtitle, COALESCE(doc.country_code, '') AS dcountry_code, COALESCE(doc.phone, '') AS dphone,
                                COALESCE(ds.sign_image, '') AS dsign_image,

                                COALESCE(fm.profile_image, '') AS fm_pimage, COALESCE(fm.name, '') AS fmname, COALESCE(bg.name, '') AS bg_name, COALESCE(fm.gender, '') AS fmgender, COALESCE(fm.patient_age, '') AS fmage, 
                                COALESCE(fm.height, '') AS fmheight, COALESCE(fm.weight, '') AS fmweight, COALESCE(fm.allergies, '') AS fmallergies,
                                COALESCE(fm.medical_history, '') AS fm_medi_history,

                                COALESCE(hos.name, '') AS hname, COALESCE(hos.address, '') AS haddress, COALESCE(hos.country_code, '') AS hcountry_code, COALESCE(hos.phone, '') AS hphone,
                                COALESCE(hos.email, '') AS hemail

                                FROM tbl_booked_appointment AS boap
                                LEFT JOIN tbl_customer AS cus ON cus.id = boap.customer_id
                                LEFT JOIN tbl_doctor_list AS doc ON doc.id = boap.doctor_id
                                LEFT JOIN tbl_family_member AS fm ON fm.id = '${family_mem_id}' AND fm.customer_id = '${cus_id}'
                                LEFT JOIN tbl_blood_group AS bg ON bg.id = fm.blood_type
                                LEFT JOIN tbl_doctor_setting AS ds ON ds.doctor_id = boap.doctor_id
                                LEFT JOIN tbl_hospital_list AS hos ON hos.id = boap.hospital_id
                                LEFT JOIN tbl_department_list AS dep ON dep.id = boap.department_id
                                LEFT JOIN tbl_doctor_hos_depart_list AS dhd ON dhd.id = boap.sub_depar_id
                                LEFT JOIN tbl_general_settings AS gs ON 1 = 1
                                WHERE boap.id = '${appoint_id}';`);
    
    if (ag == '') return {status: false, url: ''};

    const vitalp = await DataFind(`SELECT dvp.id, dvp.title, vp.text
                                    FROM tbl_booked_appointment AS ba
                                    JOIN JSON_TABLE(
                                        JSON_EXTRACT(ba.vitals_physical, '$[*]."${family_mem_id}"[*]'),
                                        '$[*]' COLUMNS (
                                            id INT PATH '$.id', text LONGTEXT PATH '$.text'
                                        )
                                    ) AS vp
                                    JOIN tbl_doctor_vitals_physical AS dvp ON vp.id = dvp.id AND dvp.doctor_id = ba.doctor_id AND dvp.status = '1'
                                    WHERE ba.id = '${appoint_id}' AND ba.customer_id = '${cus_id}';`);

    const adrug = await DataFind(`SELECT ba.id AS appoint_id, dp.*, medi.name AS medicine_name
                                  FROM tbl_booked_appointment AS ba
                                  JOIN JSON_TABLE(
                                      JSON_EXTRACT(ba.drugs_prescription, '$[*]."${family_mem_id}"[*]'),
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
                                  WHERE ba.id = '${appoint_id}' AND ba.customer_id = '${cus_id}';`);

    const adiagno = await DataFind(`SELECT ddt.id AS id, ddt.name AS name, ddt.description AS description
                                      FROM tbl_booked_appointment AS boap
                                      JOIN tbl_doctor_diagnosis_test AS ddt
                                      ON JSON_CONTAINS(
                                          JSON_EXTRACT(boap.diagnosis_test, '$[*]."${family_mem_id}"'), 
                                          CAST(ddt.id AS JSON)
                                      )
                                      AND ddt.status = '1'
                                      WHERE boap.id = '${appoint_id}' AND boap.customer_id = '${cus_id}';`);

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let a = ag[0];

    a.book_date = new Date(a.book_date).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: timezone});

    a.treatment_time = typeof a.treatment_time === 'string' ? JSON.parse(a.treatment_time) : a.treatment_time || {};

    const tt = a.treatment_time;
    tt.start_time = tt.start_time ? new Date(tt.start_time).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: timezone}) : '-';
    tt.end_time = tt.end_time && tt.start_time !== '-' ? new Date(tt.end_time).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: timezone }) : '-';
    tt.tot_time = (tt.start_time !== '-' && tt.end_time !== '-') ? await AllFunction.TwoTimeDiference(tt.end_time, tt.start_time) : { hour: '00', minute: '00', second: '00' };
    a.treatment_time = tt;

    let num = adiagno.length;
    let fn = adiagno.slice(0, Math.ceil(num / 2));
    let sn = adiagno.slice(Math.ceil(num / 2));

    function toBase64(filePath) {
        try {
            const data = fs.readFileSync(path.resolve(__dirname, `../public/${filePath}`));
            const ext = path.extname(filePath).slice(1); // 'png', 'jpg'
            return `data:image/${ext};base64,${data.toString('base64')}`;
        } catch (err) {
            return '';
        }
    }

    const logoBase64 = toBase64(a.gslight_image);
    const pimageBase64 = toBase64(a.fm_pimage);
    const signBase64 = toBase64(a.dsign_image);

    // HTML content with inline CSS (no external dependencies)
    let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${a.fmname} Prescription</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: Arial, sans-serif;
                font-size: 14px;
                line-height: 1.4;
                color: #333;
                background: white;
            }
            
            .container {
                max-width: 100%;
                margin: 0 5px 5px 5px;
                padding: 20px;
            }
            
            .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 20px;
                border-bottom: 2px solid #e5e5e5;
                padding-bottom: 20px;
            }
            
            .header-left, .header-right {
                flex: 1;
            }
            
            .header-center {
                flex: 0 0 auto;
                margin: 0 20px;
                text-align: center;
            }
            
            .header-right {
                text-align: right;
            }
            
            .logo {
                width: 80px;
                height: auto;
            }
            
            .doctor-name {
                font-size: 24px;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 5px;
            }
            
            .hospital-name {
                font-size: 18px;
                font-weight: 600;
                color: #2563eb;
                margin-bottom: 5px;
            }
            
            .contact-info {
                font-size: 12px;
                color: #666;
                margin-bottom: 3px;
            }
            
            .appointment-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
                gap: 40px;
            }
            
            .info-section {
                flex: 1;
            }
            
            .info-item {
                margin-bottom: 8px;
                font-size: 13px;
            }
            
            .info-label {
                font-weight: 600;
                display: inline-block;
                min-width: 120px;
            }
            
            .treatment-time {
                background-color: #f8f9fa;
                padding: 25px;
                margin-bottom: 30px;
                border-radius: 8px;
            }
            
            .section-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 20px;
                color: #333;
            }
            
            .treatment-info-grid {
                display: flex;
                gap: 40px;
            }
            
            .treatment-col {
                flex: 1;
            }
            
            .patient-detail {
                background-color: #f8f9fa;
                padding: 25px;
                margin-bottom: 30px;
                border-radius: 8px;
            }
            
            .patient-info {
                display: flex;
                gap: 30px;
                align-items: flex-start;
            }
            
            .patient-photo {
                width: 140px;
                height: 160px;
                object-fit: cover;
                border-radius: 8px;
                border: 1px solid #ddd;
                flex-shrink: 0;
            }
            
            .patient-data {
                flex: 1;
                display: flex;
                gap: 50px;
            }
            
            .patient-col {
                flex: 1;
            }
            
            .vitals-section {
                margin-bottom: 25px;
            }
            
            .vitals-content {
                background-color: #f3f4f6;
                padding: 15px;
                border-radius: 8px;
            }
            
            .vital-item {
                margin-bottom: 10px;
            }
            
            .vital-item:last-child {
                margin-bottom: 0;
            }
            
            .prescription-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 25px;
            }
            
            .prescription-table th {
                background-color: #f3f4f6;
                padding: 12px 8px;
                text-align: left;
                font-weight: 600;
                border: 1px solid #d1d5db;
                font-size: 13px;
            }
            
            .prescription-table td {
                padding: 10px 8px;
                border: 1px solid #d1d5db;
                font-size: 12px;
                vertical-align: top;
            }
            
            .prescription-table tr:nth-child(even) {
                background-color: #fafafa;
            }
            
            .diagnosis-section {
                margin-bottom: 25px;
            }
            
            .diagnosis-columns {
                display: flex;
                gap: 30px;
            }
            
            .diagnosis-col {
                flex: 1;
            }
            
            .diagnosis-list {
                list-style: none;
                padding-left: 0;
            }
            
            .diagnosis-item {
                margin-bottom: 12px;
                position: relative;
                padding-left: 20px;
            }
            
            .diagnosis-item:before {
                content: "•";
                position: absolute;
                left: 0;
                top: 0;
                color: #2563eb;
                font-weight: bold;
            }
            
            .diagnosis-name {
                font-weight: 600;
                margin-bottom: 3px;
            }
            
            .diagnosis-desc {
                font-size: 12px;
                color: #666;
                margin-left: 0;
            }
            
            .signature-section {
                text-align: right;
                margin-top: 40px;
                padding-top: 20px;
            }
            
            .signature-image {
                height: 60px;
                margin-bottom: 10px;
            }
            
            .signature-name {
                font-weight: 600;
                font-size: 14px;
            }
            
            @media print {
                body { print-color-adjust: exact; }
                .container { padding: 15px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
              <div class="doctor-name">${a.dname}</div>
              <div class="doctor-title">${a.dtitle}</div>
              <div class="contact-info">Mob : ${a.dcountry_code}${a.dphone}</div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div class="doctor-name">${a.hname}</div>
                <div class="doctor-title">${a.hemail}</div>
                <div class="contact-info">Mob : ${a.hcountry_code}${a.hphone}</div>
            </div>

            <div class="appointment-info">
                <div class="info-section">
                    <div class="info-item">
                        <span class="info-label">Appointment ID :</span>
                        <span class="info-value">#${a.id}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Department :</span>
                        <span class="info-value">${a.department_name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Sub Type :</span>
                        <span class="info-value">${a.sub_title}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Address :</span>
                        <span class="info-value">${a.haddress}</span>
                    </div>
                </div>
                <div class="info-section">
                    <div class="info-item">
                        <span class="info-label">Book Date :</span>
                        <span class="info-value">${a.book_date}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Appointment Date :</span>
                        <span class="info-value">${a.appointment_date}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Appointment Time :</span>
                        <span class="info-value">${a.appointment_time}</span>
                    </div>
                </div>
            </div>`;

    // Treatment time section
    if (a.treatment_time.start_time !== '-' || a.treatment_time.end_time !== '-') {
        htmlContent += `
            <div class="treatment-time">
                <h3 class="section-title">Treatment time details :-</h3>
                <div class="treatment-info-grid">
                    <div class="treatment-col">
                        <div class="info-item">
                            <span class="info-label">Start time :</span>
                            <span class="info-value">${a.treatment_time.start_time}</span>
                        </div>
                    </div>
                    <div class="treatment-col">
                        <div class="info-item">
                            <span class="info-label">End time :</span>
                            <span class="info-value">${a.treatment_time.end_time}</span>
                        </div>
                    </div>
                    <div class="treatment-col">
                        <div class="info-item">
                            <span class="info-label">Total time :</span>
                            <span class="info-value">${a.treatment_time.tot_time.hour}:${a.treatment_time.tot_time.minute}:${a.treatment_time.tot_time.second}</span>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    // Patient details section
    htmlContent += `
            <div class="patient-detail">
                <h3 class="section-title">Patient Detail</h3>
                <div class="patient-info">
                    ${pimageBase64 ? `<img src="${pimageBase64}" class="patient-photo" alt="Patient Photo"/>` : '<div class="patient-photo" style="background-color: #e5e5e5;"></div>'}
                    <div class="patient-data">
                        <div class="patient-col">
                            <div class="info-item">
                                <span class="info-label">Name :</span>
                                <span class="info-value">${a.fmname}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Gender :</span>
                                <span class="info-value">${a.fmgender}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Age :</span>
                                <span class="info-value">${a.fmage}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Allergies :</span>
                                <span class="info-value">${a.fmallergies}</span>
                            </div>
                        </div>
                        <div class="patient-col">
                            <div class="info-item">
                                <span class="info-label">Blood Group :</span>
                                <span class="info-value">${a.bg_name}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Height :</span>
                                <span class="info-value">${a.fmheight}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Weight :</span>
                                <span class="info-value">${a.fmweight}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Medical History :</span>
                                <span class="info-value">${a.fm_medi_history}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

    // Vitals section
    if (vitalp && vitalp.length > 0) {
        htmlContent += `
            <div class="vitals-section">
                <h3 class="section-title">Vitals and Physical Information</h3>
                <div class="vitals-content">`;
        
        vitalp.forEach((val) => {
            htmlContent += `<div class="vital-item"><strong>${val.title}:</strong> ${val.text}</div>`;
        });
        
        htmlContent += `</div></div>`;
    }

    // Prescription section
    if (adrug && adrug.length > 0) {
        htmlContent += `
            <div class="prescription-section">
                <h3 class="section-title">Prescription (℞)</h3>
                <table class="prescription-table">
                    <thead>
                        <tr>
                            <th>Medicine</th>
                            <th>Dosage</th>
                            <th>Duration</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        adrug.forEach((dval) => {
            htmlContent += `
                        <tr>
                            <td>${dval.type}. ${dval.medicine_name} ${dval.Dosage}</td>
                            <td>${dval.Frequency} ${dval.Time}</td>
                            <td>
                                <div>${dval.Days}</div>
                                <div style="margin-top: 5px; font-style: italic;">${dval.Instructions}</div>
                            </td>
                        </tr>`;
        });
        
        htmlContent += `</tbody></table></div>`;
    }

    // Diagnosis section
    if (adiagno && adiagno.length > 0) {
        htmlContent += `
            <div class="diagnosis-section">
                <h3 class="section-title">Diagnosis Tests</h3>
                <div class="diagnosis-columns">
                    <div class="diagnosis-col">
                        <ul class="diagnosis-list">`;
        
        fn.forEach((dval) => {
            htmlContent += `
                            <li class="diagnosis-item">
                                <div class="diagnosis-name">${dval.name}</div>
                                <div class="diagnosis-desc">${dval.description}</div>
                            </li>`;
        });
        
        htmlContent += `</ul></div><div class="diagnosis-col"><ul class="diagnosis-list">`;
        
        sn.forEach((dval) => {
            htmlContent += `
                            <li class="diagnosis-item">
                                <div class="diagnosis-name">${dval.name}</div>
                                <div class="diagnosis-desc">${dval.description}</div>
                            </li>`;
        });
        
        htmlContent += `</ul></div></div></div>`;
    }

    // Signature section
    htmlContent += `
            <div class="signature-section">
                ${signBase64 ? `<img src="${signBase64}" class="signature-image" alt="Digital Signature"/>` : ''}
                <div class="signature-name">${a.dname}</div>
            </div>
        </div>
    </body>
    </html>`;

    // PDF generation options for html-pdf
    const options = {
        format: 'A4',
        border: {
            top: '0.1in',
            right: '0.1in',
            bottom: '0.1in',
            left: '0.1in'
        },
        header: {
            height: '0mm'
        },
        footer: {
            height: '8mm',
            contents: {
                default: `<div style="font-size:10px; width:100%; margin-top: 5px; padding: 0 10px 0 10px; display: flex; justify-content: space-between; align-items: center; color: #444; font-family: Arial, sans-serif;">
                            <div style="float: left;">
                              <a href="${a.web_link}" style="color: #2563eb; text-decoration: none;">${a.gslight_title}</a>
                            </div>
                            <div style="text-align: center;">
                              Page {{page}} of {{pages}}
                            </div>
                        </div>`
            }
        },
        type: 'pdf',
        quality: '100',
        dpi: 300,
        zoomFactor: 1,
        renderDelay: 1000
    };

    return new Promise((resolve, reject) => {
        pdf.create(htmlContent, options).toBuffer((err, buffer) => {
            if (err) {
                console.error('PDF generation error:', err);
                resolve({ status: false, url: '' });
                return;
            }

            try {
                const pdf_URL = `uploads/customer_pdf/${a.fmname}_prescription.pdf`;
                const folderPath = path.resolve(__dirname, `../public/${pdf_URL}`);
                
                // Ensure directory exists
                fs.ensureDirSync(path.dirname(folderPath));
                
                // Write PDF buffer to file
                fs.writeFileSync(folderPath, buffer);
                
                console.log(`PDF generated successfully at: ${folderPath}`);
                resolve({ status: true, url: pdf_URL });
                
            } catch (fileErr) {
                console.error('File write error:', fileErr);
                resolve({ status: false, url: '' });
            }
        });
    });
}

module.exports = { CreateAppointmentPDF };







