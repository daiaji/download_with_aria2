var manager = document.body;
var queuebtn = document.querySelector('#queue_btn');
var optionsbtn = document.querySelector('#options_btn');
var chooseQueue = document.querySelector('#choose');
var activeStat = document.querySelector('#status #active');
var waitingStat = document.querySelector('#status #waiting');
var stoppedStat = document.querySelector('#status #stopped');
var downloadStat = document.querySelector('#status #download');
var uploadStat = document.querySelector('#status #upload');
var activeQueue = document.querySelector('#queue > #active');
var waitingQueue = document.querySelector('#queue > #waiting');
var pausedQueue = document.querySelector('#queue > #paused');
var completeQueue = document.querySelector('#queue > #complete');
var removedQueue = document.querySelector('#queue > #removed');
var errorQueue = document.querySelector('#queue > #error');
var sessionLET = document.querySelector('.template > .session');
var fileLET = document.querySelector('.template > .file');
var uriLET = document.querySelector('.template > .uri');
var detailed;

document.addEventListener('keydown', (event) => {
    var {ctrlKey, key} = event;
    if (ctrlKey) {
        if (key === 'q') {
            event.preventDefault();
            managerQueue();
        }
        else if (key === 'r') {
            event.preventDefault();
            managerPurge();
        }
        else if (key === 'd') {
            event.preventDefault();
            managerDownload();
        }
        else if (key === 's') {
            event.preventDefault();
            managerOptions();
        }
    }
});

document.addEventListener('click', ({target}) => {
    var {id} = target;
    if (id !== 'queue_btn' && !chooseQueue.contains(target)) {
        manager.classList.remove('queue');
    }
});

document.querySelector('#menu').addEventListener('click', ({target}) => {
    var {id} = target;
    if (id === 'queue_btn') {
        managerQueue()
    }
    else if (id === 'purge_btn') {
        managerPurge();
    }
    else if (id === 'download_btn') {
        managerDownload();
    }
    else if (id === 'options_btn') {
        managerOptions();
    }
});

chooseQueue.addEventListener('click', ({target}) => {
    manager.classList.toggle(target.id);
});

function managerQueue() {
    manager.classList.toggle('queue');
}

async function managerPurge() {
    await aria2RPC.call('aria2.purgeDownloadResult');
    completeQueue.innerHTML = removedQueue.innerHTML = errorQueue.innerHTML = '';
    stoppedStat.textContent = '0';
    stoppedTask = {};
    globalTask = {...activeTask, ...waitingTask};
}

function aria2StartUp() {
    activeTask = {};
    waitingTask = {};
    stoppedTask = {};
    globalTask = {};
    aria2RPC.batch([
        ['aria2.getGlobalStat'], ['aria2.tellActive'],
        ['aria2.tellWaiting', 0, 999], ['aria2.tellStopped', 0, 999]
    ]).then(([{downloadSpeed, uploadSpeed}, active, waiting, stopped]) => {
        [...active, ...waiting, ...stopped].forEach(printSession);
        downloadStat.textContent = getFileSize(downloadSpeed);
        uploadStat.textContent = getFileSize(uploadSpeed);
        aria2Client();
    }).catch((error) => {
        activeStat.textContent = waitingStat.textContent = stoppedStat.textContent = downloadStat.textContent = uploadStat.textContent = '0';
        activeQueue.innerHTML = waitingQueue.innerHTML = pausedQueue.innerHTML = completeQueue.innerHTML = removedQueue.innerHTML = errorQueue.innerHTML = '';
    });
}

function aria2Client() {
    aria2Alive = setInterval(updateManager, aria2Store['manager_interval']);
    aria2Socket = new WebSocket(aria2Store['jsonrpc_uri'].replace('http', 'ws'));
    aria2Socket.onmessage = async ({data}) => {
        var {method, params: [{gid}]} = JSON.parse(data);
        if (method !== 'aria2.onBtDownloadComplete') {
            addSession(gid);
            if (method === 'aria2.onDownloadStart' && waitingTask[gid]) {
                removeSession('waiting', gid);
            }
            else if (method !== 'aria2.onDownloadStart' && activeTask[gid]) {
                removeSession('active', gid);
            }
        }
    };
}

async function updateManager() {
    var [{downloadSpeed, uploadSpeed}, active] = await aria2RPC.batch([
        ['aria2.getGlobalStat'], ['aria2.tellActive']
    ]);
    active.forEach(printSession);
    downloadStat.textContent = getFileSize(downloadSpeed);
    uploadStat.textContent = getFileSize(uploadSpeed);
}

function updateSession(task, gid, status) {
    var cate = status === 'active' ? 'active' : 'waiting,paused'.includes(status) ? 'waiting' : 'stopped';
    if (self[`${cate}Task`][gid] === undefined) {
        self[`${cate}Task`][gid] = task;
        self[`${cate}Stat`].textContent ++;
    }
    self[`${status}Queue`].appendChild(task);
    task.cate = cate;
}

async function addSession(gid) {
    var result = await aria2RPC.call('aria2.tellStatus', gid);
    var task = printSession(result);
    var {status} = result;
    updateSession(task, gid, status);
}

function removeSession(cate, gid, task) {
    self[`${cate}Stat`].textContent --;
    delete self[`${cate}Task`][gid];
    if (task) {
        task.remove();
        delete globalTask[gid];
    }
}

function printSession({gid, status, files, bittorrent, completedLength, totalLength, downloadSpeed, uploadSpeed, connections, numSeeders}) {
    var task = globalTask[gid] ?? parseSession(gid, status, bittorrent);
    var time = (totalLength - completedLength) / downloadSpeed;
    var days = time / 86400 | 0;
    var hours = time / 3600 - days * 24 | 0;
    var minutes = time / 60 - days * 1440 - hours * 60 | 0;
    var seconds = time - days * 86400 - hours * 3600 - minutes * 60 | 0;
    var percent = (completedLength / totalLength * 10000 | 0) / 100;
    var {name, completed, total, day, hour, minute, second, connect, download, upload, ratio} = task;
    name.textContent = getDownloadName(gid, bittorrent, files);
    completed.textContent = getFileSize(completedLength);
    total.textContent = getFileSize(totalLength);
    day.textContent = days > 0 ? days : '';
    hour.textContent = hours > 0 ? hours : '';
    minute.textContent = minutes > 0 ? minutes : '';
    second.textContent = seconds > 0 ? seconds : '';
    connect.textContent = bittorrent ? `${numSeeders} (${connections})` : connections;
    download.textContent = getFileSize(downloadSpeed);
    upload.textContent = getFileSize(uploadSpeed);
    ratio.textContent = percent;
    ratio.style.width = `${percent}%`;
    if (detailed === task) {
        printTaskFileList(files);
    }
    return task;
}

function parseSession(gid, status, bittorrent) {
    var task = sessionLET.cloneNode(true);
    var [name, completed, day, hour, minute, second, total, connect, download, upload, ratio, files, save, urls] = task.querySelectorAll('#title, #local, #day, #hour, #minute, #second, #remote, #connect, #download, #upload, #ratio, #files, #save_btn, #uris');
    Object.assign(task, {name, completed, day, hour, minute, second, total, connect, download, upload, ratio, files, save, urls});
    task.id = gid;
    task.classList.add(bittorrent ? 'p2p' : 'http');
    task.addEventListener('click', async ({target, ctrlKey}) => {
        var status = task.parentNode.id;
        var id = target.id;
        if (id === 'remove_btn') {
            taskRemove(task, gid, status);
        }
        else if (id === 'detail_btn') {
            taskDetail(task, gid);
        }
        else if (id === 'retry_btn') {
            taskRetry(task, gid);
        }
        else if (id === 'meter' || id === 'ratio') {
            taskPause(task, gid, status);
        }
        else if (id === 'proxy_btn') {
            taskProxy(target, gid);
        }
        else if (id === 'save_btn') {
            taskFiles(target, files, gid);
        }
        else if (id === 'this_file') {
            taskSelectFile(task.cate, save, target);
        }
        else if (id === 'adduri_btn') {
            taskAddUri(target, gid);
        }
        else if (id === 'this_uri') {
            taskRemoveUri(target.textContent, gid, ctrlKey);
        }
    });
    task.querySelector('#options').addEventListener('change', ({target}) => {
        var {id, value} = target;
        aria2RPC.call('aria2.changeOption', gid, {[id]: value});
    });
    globalTask[gid] = task;
    updateSession(task, gid, status);
    return task;
}

async function taskRemove(task, gid, status) {
    if ('active,waiting,paused'.includes(status)) {
        await aria2RPC.call('aria2.forceRemove', gid);
        if (status !== 'active') {
            removeSession('waiting', gid, task);
        }
    }
    else {
        await aria2RPC.call('aria2.removeDownloadResult', gid);
        removeSession('stopped', gid, task);
    }
}

async function taskDetail(task, gid) {
    closeTaskDetail();
    if (detailed === task) {
        detailed = null;
    }
    else {
        var [files, options] = await getTaskDetail(gid);
        task.querySelectorAll('input, select').disposition(options);
        detailed = task;
        printTaskFileList(files);
        task.classList.add('extra');
    }
}

async function taskRetry(task, gid) {
    var [files, options] = await getTaskDetail(gid);
    var {uris, path} = files[0];
    var url = [...new Set(uris.map(({uri}) => uri))];
    if (path) {
        var ni = path.lastIndexOf('/');
        options['dir'] = path.slice(0, ni);
        options['out'] = path.slice(ni + 1);
     }
     var [id] = await aria2RPC.batch([
        ['aria2.addUri', url, options], ['aria2.removeDownloadResult', gid]
     ]);
     addSession(id);
     removeSession('stopped', gid, task);
}

async function taskPause(task, gid, status) {
    if ('active,waiting'.includes(status)) {
        await aria2RPC.call('aria2.forcePause', gid);
        pausedQueue.appendChild(task);
    }
    else if (status === 'paused') {
        await aria2RPC.call('aria2.unpause', gid);
        waitingQueue.appendChild(task);
    }
}

async function taskProxy(proxy, gid) {
    await aria2RPC.call('aria2.changeOption', gid, {'all-proxy': aria2Store['proxy_server']});
    proxy.previousElementSibling.value = aria2Store['proxy_server'];
}

async function taskFiles(save, files, gid) {
    var selected = [...files.querySelectorAll('.ready')].map(index => index.textContent);
    await aria2RPC.call('aria2.changeOption', gid, {'select-file': selected.join()});
    save.style.display = 'none';
}

function taskSelectFile(cate, save, file) {
    if (cate !== 'stopped' && file.checkbox) {
        file.className = file.className === 'ready' ? '' : 'ready';
        save.style.display = 'block';
    }
}

async function taskAddUri(adduri, gid) {
    var uri = adduri.previousElementSibling;
    await aria2RPC.call('aria2.changeUri', gid, 1, [], [uri.value]);
    uri.value = '';
}

async function taskRemoveUri(uri, gid, ctrl) {
    ctrl ? aria2RPC.call('aria2.changeUri', gid, 1, [uri], []) : navigator.clipboard.writeText(uri);
}

function getTaskDetail(gid) {
    return aria2RPC.batch([
        ['aria2.getFiles', gid], ['aria2.getOption', gid]
    ]);
}

function closeTaskDetail() {
    if (detailed) {
        detailed.classList.remove('extra');
        detailed.querySelector('#files').innerHTML = detailed.querySelector('#uris').innerHTML = '';
        detailed.querySelector('#save_btn').style.display = 'none';
    }
}

function printFileItem(list, index, path, length, selected, uris) {
    var item = fileLET.cloneNode(true);
    var [file, name, size, ratio] = item.querySelectorAll('#this_file, #name, #size, #done');
    Object.assign(item, {file, name, size, ratio});
    file.checkbox = uris.length === 0; 
    file.textContent = index;
    file.className = selected === 'true' ? 'ready' : '';
    name.textContent = path.slice(path.lastIndexOf('/') + 1);
    name.title = path;
    size.textContent = getFileSize(length);
    list.appendChild(item);
    return item;
}

function printTaskFileList(files) {
    var fileList = detailed.files;
    var items = [...fileList.childNodes];
    files.forEach(({index, path, length, selected, completedLength, uris}, step) => {
        var item = items[step] ?? printFileItem(fileList, index, path, length, selected, uris);
        item.ratio.textContent = (completedLength / length * 10000 | 0) / 100;
        if (uris.length !== 0) {
            printTaskUriList(uris);
        }
    });
}

function printUriItem(list, uri) {
    var item = uriLET.cloneNode(true);
    var [url, used, wait] = item.querySelectorAll('#this_uri, #used, #wait');
    Object.assign(item, {url, used, wait});
    list.appendChild(item);
    return item;
}

function printTaskUriList(uris) {
    var uriList = detailed.urls;
    var items = [...uriList.childNodes];
    var result = {};
    var urls = [];
    uris.forEach(({uri, status}) => {
        var {yes, no} = result[uri] ?? {yes: 0, no: 0};
        if (yes === 0 && no === 0) {
            urls.push(uri);
        }
        status === 'used' ? yes ++ : no ++;
        result[uri] = {yes, no};
    });
    urls.forEach((uri, step) => {
        var item = items[step] ?? printUriItem(uriList, uri);
        var {yes, no} = result[uri];
        var {url, used, wait} = item;
        url.textContent = uri;
        used.textContent = yes;
        wait.textContent = no;
    });
    items.slice(urls.length).forEach((item) => item.remove());
}
