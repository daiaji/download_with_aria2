document.querySelectorAll('[i18n]').forEach(item => {
    item.innerText = chrome.i18n.getMessage(item.innerText);
});

document.querySelectorAll('[title]').forEach(item => {
    item.title = chrome.i18n.getMessage(item.title);
});

chrome.storage.local.get(null, json => {
    aria2Store = json;
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['secret_token']);
    aria2RPCClient();
});

function getFileSize(bytes) {
    if (isNaN(bytes)) {
        return '??';
    }
    else if (bytes < 1024) {
        return bytes + ' B';
    }
    else if (bytes < 1048576) {
        return (bytes / 10.24 | 0) / 100 + ' KB';
    }
    else if (bytes < 1073741824) {
        return (bytes / 10485.76 | 0) / 100 + ' MB';
    }
    else if (bytes < 1099511627776) {
        return (bytes / 10737418.24 | 0) / 100 + ' GB';
    }
    else {
        return (bytes / 10995116277.76 | 0) / 100 + ' TB';
    }
}

function printGlobalOptions(options, entries) {
    document.querySelectorAll(entries).forEach(entry => {
        entry.value = options[entry.name] ?? '';
        if (entry.hasAttribute('data-size')) {
            var size = getFileSize(entry.value);
            entry.value = size.slice(0, size.indexOf(' ')) + size.slice(size.indexOf(' ') + 1, -1);
        }
    });
}

function promiseFileReader(file, method) {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();
        if (method === 'json') {
            reader.onload = () => {
                var json = JSON.parse(reader.result);
                resolve(json);
            };
            reader.readAsText(file);
        }
        else if (method === 'base64') {
            reader.onload = () => {
                var base64 = reader.result.slice(reader.result.indexOf(',') + 1);
                resolve(base64);
            };
            reader.readAsDataURL(file);
        }
        else {
            var error = new Error('parameter 2 "method" is not defined');
            reject(error);
        }
    });
}
