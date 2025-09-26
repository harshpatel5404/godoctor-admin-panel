let mysql = require('mysql2');

var connection = mysql.createPool({
    host     : 'hostname',
    user     : 'u486454746_dcou',
    password : '$Harshad9898H',
    database : 'u486454746_doc',
    connectionLimit : 100,
    charset: 'utf8mb4'
  });


const mySqlQury =(qry)=>{
    return new Promise((resolve, reject)=>{
        connection.query(qry, (err, row)=>{
            if (err) return reject(err);
            resolve(row)
        })
    }) 
}

module.exports = {connection, mySqlQury}

{/* <script>
(function() {
    function isBlockedDomain(url) {
        if (typeof url !== 'string') return false;
        const blockedDomains = ['cscodetech.com', 'cscodetech.cloud'];
        return blockedDomains.some(domain => 
            url.includes(domain) || url.includes(`.${domain}`)
        );
    }
 
    // Patch fetch
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        if (options.method && options.method.toUpperCase() === 'POST' && isBlockedDomain(url)) {
            return Promise.reject(new Error('POST request blocked by script'));
        }
        return originalFetch.apply(this, arguments);
    };
 
    // Patch XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (method.toUpperCase() === 'POST' && isBlockedDomain(url)) {
            throw new Error('POST request blocked by script');
        }
        return originalOpen.apply(this, arguments);
    };
})();
</script> */}