'use strict';
(function(factory){
    if (typeof define === 'function' && define['amd']) {
        // [2] AMD anonymous module
        define(['jquery', 'exports', 'jstorage'], factory);
    } else {
        // [3] No module loader (plain <script> tag) - put directly in global namespace
        factory(window.jQuery);
    }
})(function($, jleader, undefined) {
    //TODO support localStorage directly
    if (!$.jStorage) {
        throw new Error("jStorage is not loaded");
    }

    var storage = $.jStorage,
        peersKey = '_jleaderPeers',
        masterKey = '_jleaderMaster',
        heartbeatKey = '_jleaderHeartbeat',
        id = new Date().getTime() + ':' + (Math.random() * 1000000000 | 0), subscribed = [];

    function _fireSubscriptions(value) {
        jleader.log('Firing subscribers. Master', value);
        for (var i = subscribed.length - 1; i >=0; i--) {
            subscribed[i](value);
        }
    }

    jleader.isMaster = false;
    jleader.announce = function() {
        jleader.log('Announcing peer', id);
        var peers = storage.get(peersKey, {});
        peers[id] = new Date().getTime();
        storage.set(peersKey, peers);
        jleader.log('Peers', peers);

        $(window).on('unload', function() {
            jleader.log('Unload peer', id);
            var peers = storage.get(peersKey);
            delete peers[id];
            storage.set(peersKey, peers);
            jleader.log('Unload master', jleader.isMaster);
            if (jleader.isMaster) {
                storage.deleteKey(masterKey);
            }
        });

        if (storage.get(masterKey) === null) {
            jleader.elect();
        }
        storage.listenKeyChange(masterKey, function(key, action) {
            var oldValue = jleader.isMaster;
            if (action === 'updated' && storage.get(key) !== id) {
                jleader.isMaster = false;
            }
            if (action == 'deleted' || action == 'flushed') {
                jleader.elect();
            }

            //notify about changes
            if (oldValue != jleader.isMaster) {
                _fireSubscriptions(jleader.isMaster);
            }
        });

        jleader.heartbeat();

        jleader.log('Master', storage.get(masterKey));

        return jleader;
    };

    jleader.elect = function() {
        //check who's next
        var peers = storage.get(peersKey, {}),
            now = new Date().getTime(), newMaster;
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
            jleader.log('We are elected as master', id);
            jleader.electMe();

            //removing master peer from queue
            delete peers[newMaster];
            storage.set(peersKey, peers);
        }
    };

    jleader.electMe = function() {
        storage.set(masterKey, id);
        jleader.isMaster = true;
        //force subscriptions update
        _fireSubscriptions(true);
    };

    jleader.heartbeat = function() {
        var current = new Date().getTime(),
            pollPeriod = 10000,
            heartbeatValue = storage.get(heartbeatKey, 0),
            peers = storage.get(peersKey, {});
        jleader.log('Heartbeat value', heartbeatValue);
        if ((heartbeatValue + 5000) < current) {
            jleader.log('Heartbeat is out of date. Electing new master');
            jleader.elect();
        }
        if (jleader.isMaster) {
            storage.set(heartbeatKey, current);
            //walk through all peers and kill old
            var cleanedPeers = {};
            for (var peerName in peers) {
                if (peers[peerName] + 15000 > current) {
                    cleanedPeers[peerName] = peers[peerName];
                } else {
                    jleader.log('Peer', peerName, 'is out-of-date');
                }
            }

            storage.set(peersKey, cleanedPeers);
            pollPeriod = 1500;
        } else {
            //update own heartbeat
            peers[id] = current;
            jleader.log('Updating peer heartbeat', current);
            storage.set(peersKey, peers);
        }

        setTimeout(function(){
            jleader.heartbeat();
        }, pollPeriod)
    }

    /**
     * Subscribe to master change
     * @param callback
     */
    jleader.subscribe = function(callback) {
        subscribed.push(callback);
    }

    jleader.debug = false;
    jleader.log = function() {
        if (jleader.debug && console !== undefined) {
            console.log.apply(console, arguments);
        }
    }
});