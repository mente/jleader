'use strict';
(function(factory){
    if (typeof define === 'function' && define['amd']) {
        // [2] AMD anonymous module
        define(['exports'], factory);
    } else {
        // [3] No module loader (plain <script> tag) - put directly in global namespace
        factory(window.jleader = {});
    }
})(function(jleader, undefined) {
    
    var storage,
        peersKey = '_jleaderPeers',
        masterKey = '_jleaderMaster',
        heartbeatKey = '_jleaderHeartbeat',
        subscribed = [],
        id = new Date().getTime() + ':' + (Math.random() * 1000000000 | 0);

    if ((storage = window.localStorage) === undefined) {
        throw new Error("localStorage is not found");
    }
    if (!JSON) {
        throw new Error("JSON support not found");
    }

    //utility functions
    function on(type, listener) {
        if (window.addEventListener) {
            window.addEventListener(type, listener);
        } else { //IE8
            window.attachEvent('on' + type, listener);
        }
    }
    
    function getItem(key, defaultValue) {
        var val = storage[key];
        if (val) {
            return val[0] === '[' || val[0] === '{' ? JSON.parse(val) : val;
        } else {
            return defaultValue;
        }
    }
    
    function setItem(key, value) {
        if (typeof value === 'object') {
            value = JSON.stringify(value);
        }
        storage[key] = value; 
    }

    jleader.id = id;

    function _fireSubscriptions(value) {
        log('Firing subscribers. Master', value);
        for (var i = subscribed.length - 1; i >=0; i--) {
            subscribed[i](value);
        }
    }

    jleader.isMaster = false;
    jleader.announce = function() {
        log('Announcing peer', id);
        var peers = getItem(peersKey, {});
        peers[id] = new Date().getTime();
        setItem(peersKey, peers);
        log('Peers', peers);

        function onUnload() {
            log('Unload peer', id);
            var peers = getItem(peersKey, {});
            delete peers[id];
            setItem(peersKey, peers);
            log('Unload master', jleader.isMaster);
            if (jleader.isMaster) {
                storage.removeItem(masterKey);
            }
        }
        on('unload', onUnload);
        
        if (!storage[masterKey]) {
            jleader.elect();
        }
        
        on('storage', function(e) {
            if (!e) { e = window.event;}
            if (e.key !== masterKey) {
                return;
            }

            if (e.newValue !== null && storage[masterKey] !== id) {
                jleader.isMaster = false;
            } else if (e.newValue === null) { //master was unloaded
                jleader.elect();
            }

            _fireSubscriptions(jleader.isMaster);
        });
        
        jleader.heartbeat();

        log('Master', storage[masterKey]);

        return jleader;
    };

    jleader.elect = function() {
        //check who's next
        var peers = getItem(peersKey, {}),
            now = new Date().getTime(), newMaster;
        log('Candidate peers', peers);
        for (var peerName in peers) {
            //check for dead peers
            if (peers[peerName] + 15000 < now) {
                continue;
            }

            newMaster = peerName;
            break;
        }
        if (newMaster == id) {
            //we're next in queue. Electing as master
            log('We are elected as master', id);
            jleader.electMe();

            //removing master peer from queue
            delete peers[newMaster];
            setItem(peersKey, peers);
        }
    };

    jleader.electMe = function() {
        storage[masterKey] = id;
        jleader.isMaster = true;
        //force subscriptions update
        _fireSubscriptions(true);
    };

    jleader.heartbeat = function() {
        var current = new Date().getTime(),
            pollPeriod = 10000,
            heartbeatValue = storage[heartbeatKey] || 0,
            peers = getItem(peersKey, {});
        log('Heartbeat value', heartbeatValue);
        if ((heartbeatValue + 5000) < current) {
            log('Heartbeat is out of date. Electing new master');
            jleader.elect();
        }
        if (jleader.isMaster) {
            storage[heartbeatKey] = current;
            //walk through all peers and kill old
            var cleanedPeers = {};
            for (var peerName in peers) {
                if (peers[peerName] + 15000 > current) {
                    cleanedPeers[peerName] = peers[peerName];
                } else {
                    log('Peer', peerName, 'is out-of-date');
                }
            }

            setItem(peersKey, cleanedPeers);
            pollPeriod = 1500;
        } else {
            //update own heartbeat
            peers[id] = current;
            log('Updating peer heartbeat', current);
            setItem(peersKey, peers);
        }

        setTimeout(function(){
            jleader.heartbeat();
        }, pollPeriod);
    };

    /**
     * Subscribe to master change
     * @param callback
     */
    jleader.subscribe = function(callback) {
        subscribed.push(callback);
    };

    jleader.debug = false;
    function log() {
        if (jleader.debug && console !== undefined) {
            console.log.apply(console, [new Date()].concat(Array.prototype.slice.call(arguments)));
        }
    }
});
