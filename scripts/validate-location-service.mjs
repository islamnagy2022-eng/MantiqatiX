import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('web/location-adapter.js','utf8');
const sandbox={window:{},navigator:{}};
vm.runInNewContext(source,sandbox,{filename:'web/location-adapter.js'});
const location=sandbox.window.MNTYLocationAdapter;
assert.ok(location,'central location adapter must be exposed');
assert.deepEqual(JSON.parse(JSON.stringify(location.ranges.map(x=>x.km))),[1,3,5,10]);
assert.equal(location.validateCoordinates(30.1,31.2).latitude,30.1);
assert.equal(location.validateCoordinates(91,31.2),null);
assert.equal(location.validateCoordinates(30.1,181),null);
assert.equal(location.validateCoordinates('not-a-number',31.2),null);
assert.equal(location.distanceKm(0,0,0,1)>111&&location.distanceKm(0,0,0,1)<112,true);
assert.equal(location.distanceKm(91,0,0,0),null);

const square={type:'Polygon',coordinates:[[[30,29],[32,29],[32,31],[30,31],[30,29]]]};
assert.equal(location.pointInZone(30,31,square),true);
assert.equal(location.pointInZone(32,31,square),true,'points on polygon boundary count as inside');
assert.equal(location.pointInZone(35,35,square),false);
assert.equal(location.pointInZone(91,31,square),null);
assert.equal(location.pointInZone(30,31,{type:'Point',coordinates:[31,30]}),null);

const manual=location.setManualLocation(30.0444,31.2357,{label:'عنوان اختباري'});
assert.equal(manual.status,'manual');
assert.equal(manual.source,'manual');
assert.equal(manual.coords.latitude,30.0444);
assert.equal(manual.label,'عنوان اختباري');
assert.equal(location.setManualLocation(100,31),false,'invalid manual coordinates must be rejected');
assert.equal(location.getLocationSnapshot().coords.latitude,30.0444,'invalid input must not overwrite the valid location');
assert.equal(location.setRadius(5),5);
assert.equal(location.setRadius(2),5,'unsupported radius must preserve the previous radius');
assert.equal(location.statusText(),'تم اختيار الموقع يدويًا');

location.clearLocation();
assert.equal(location.getLocationSnapshot().coords,null);
assert.equal(location.getLocationSnapshot().status,'idle');

await location.requestLocation();
assert.equal(location.getLocationSnapshot().status,'unsupported','unsupported GPS must leave a usable manual-location path');

console.log('Central location service contract PASS: coordinate validation, manual location, range compatibility, distance, polygon coverage and GPS fallback.');
