var i18n = {
    'en': {
        folderff: 'Follow Browser Behavior',
        folderff_title: 'Save files into browser defined directory',
        webrequest: 'Capture Web Requests',
        webrequest_title: 'Capture MIME "application" web requests instead of browser downloads'
    },
    'zh': {
        folderff: '浏览器下载文件夹',
        folderff_title: '将文件保存至浏览器所选择的下载文件夹',
        webrequest: '抓取网络请求',
        webrequest_title: '抓取MIME类型为"应用"的网络请求而非浏览器下载'
    }
};
var lang = browser.i18n.getUILanguage();
i18n = i18n[lang] ?? i18n[lang.slice(0, lang.indexOf('-'))] ?? i18n['en'];

var folderff = document.createElement('div');
folderff.title = i18n.folderff_title;
folderff.className = 'menu';
folderff.innerHTML = `<input id="folder_firefox" name="folder_firefox" type="checkbox"><label for="folder_firefox">${i18n.folderff}</label>`;
folderff.addEventListener('change', event => {
    var {name, checked} = event.target;
    setChange(name, checked);
});
folderff.chain = {
    major: {name: 'folder_enabled', rule: true},
    minor: [
        {name: 'capture_enabled', rule: true}, {name: 'capture_webrequest', rule: false},
    ]
};

var folderen = document.querySelector('[name="folder_enabled"]').parentNode;
folderen.addEventListener('change', event => {
    if (event.target.checked) {
        if (changes['capture_webrequest']) {
            folderff.style.display = 'none';
        }
        else {
            folderff.style.display = 'block';
        }
    }
});

var container = document.createElement('div');
container.className = 'flex';
folderen.replaceWith(container);
container.append(folderen, folderff);

var webrequest = document.createElement('div');
webrequest.title = i18n.webrequest_title;
webrequest.className = 'menu';
webrequest.innerHTML = `<input id="capture_webrequest" name="capture_webrequest" type="checkbox"><label for="capture_webrequest">${i18n.webrequest}</label>`;
webrequest.chain = {
    major: {name: 'capture_enabled', rule: true},
    minor: []
};
webrequest.addEventListener('change', event => {
    var {name, checked} = event.target;
    setChange(name, checked);
    if (checked) {
        setDefaultFolder();
    }
});

var captureen = document.querySelector('[name="capture_enabled"]').parentNode;
captureen.addEventListener('change', event => {
    if (!event.target.checked) {
        setDefaultFolder();
    }
});
captureen.parentNode.after(webrequest);

checked['folder_firefox'] = 1;
checked['capture_webrequest'] = 1;
linkage['folder_enabled'].push(folderff);
linkage['capture_enabled'].push(folderff, webrequest);
linkage['capture_webrequest'] = [folderff];

function setDefaultFolder() {
    undoes.push({name: 'folder_firefox', old_value: changes['folder_firefox'], new_value: false});
    folderff.querySelector('input').checked = changes['folder_firefox'] = false;
}

function firefoxExclusive() {
    folderff.querySelector('input').checked = changes['folder_firefox'];
    webrequest.querySelector('input').checked = changes['capture_webrequest'];
    printLinkage(webrequest);
    printLinkage(folderff);
}

document.querySelector('#back_btn').addEventListener('click', firefoxExclusive);

var observer = setInterval(() => {
    if (aria2Store) {
        clearInterval(observer);
        firefoxExclusive();
    }
}, 50);