jleader
=======

leader election plugin to choose master tab among all same cross origin tabs

### Introduction

Common case for leader election is long-polling apps. jleader lets you offload server and client by sending connections only from leader tab.
Usage:
```javascript
	leader.subscribe(function(newValue) {
		if (newValue) {
			alert('This tab became master');
		} else {
			alert('This tab is not master anymore');
		}
	});
	//Announce this tab as a peer. Check whether master is online. If not - elect this tab as master
	leader.announce();
	//This way you can force this tab to become master
	if (!leader.isMaster) {
		leader.electMe()
	}
```


### How Does it Work?

Plugin is based on HTML5 localStorage fire state event. [jStorage](https://github.com/andris9/jStorage) is used underneath.
[Shared Worker](http://www.w3.org/TR/workers/#shared-workers-introduction) is the best approach but it's [not yet implemented](http://caniuse.com/#feat=sharedworkers) in major browsers. Code should work in all browsers that are supported by jStorage but not all of them were tested.

Tested browsers:
* Chrome (24+)
* Firefox (18+)
* Safari (6+)
* IE (9+)
* iOS S


*Warning* jleader is not threads afe as localStorage is not thread safe among different tabs. However everything works just fine. There is a [mutex implementation](http://balpha.de/2012/03/javascript-concurrency-and-locking-the-html5-localstorage/) and it will be added if someone encounters problems with thread safeness.