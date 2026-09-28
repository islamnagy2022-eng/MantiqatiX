/* MNTY Location Contract Adapter — reuses the canonical Android LocationEngine semantics.
   This is an integration adapter for Web/PWA, not a second location engine. */
(function(){
  const RANGES=[1,3,5,10];
  let state={isAutoGpsEnabled:true,isGpsActive:false,latitude:null,longitude:null,accuracyMeters:null,selectedDistanceKm:3};
  const listeners=new Set();
  const emit=()=>listeners.forEach(fn=>{try{fn({...state})}catch(_){}});

  const distanceKm=(lat1,lon1,lat2,lon2)=>{
    const R=6371,rad=Math.PI/180;
    const dLat=(lat2-lat1)*rad,dLon=(lon2-lon1)*rad;
    const a=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  };

  const setRange=km=>{
    const n=Number(km);
    if(RANGES.includes(n)){state.selectedDistanceKm=n;emit()}
    return state.selectedDistanceKm;
  };

  const request=({force=false}={})=>new Promise(resolve=>{
    if(!navigator.geolocation){state.isGpsActive=false;emit();resolve(null);return}
    if(!force&&state.latitude!=null&&state.longitude!=null){resolve({...state});return}
    navigator.geolocation.getCurrentPosition(
      p=>{
        state={...state,isAutoGpsEnabled:true,isGpsActive:true,latitude:p.coords.latitude,longitude:p.coords.longitude,accuracyMeters:Number.isFinite(p.coords.accuracy)?p.coords.accuracy:null};
        emit();resolve({...state});
      },
      _=>{state={...state,isGpsActive:false};emit();resolve(null)},
      {enableHighAccuracy:false,maximumAge:300000,timeout:7000}
    );
  });

  const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
  const filterAndRank=rows=>{
    const src=Array.isArray(rows)?rows.slice():[];
    if(state.latitude==null||state.longitude==null)return src;
    const max=state.selectedDistanceKm;
    return src.map(row=>{
      const lat=Number(row?.latitude),lon=Number(row?.longitude);
      const d=Number.isFinite(lat)&&Number.isFinite(lon)?distanceKm(state.latitude,state.longitude,lat,lon):null;
      return {...row,_distanceKm:d};
    }).filter(row=>max===10||row._distanceKm==null||row._distanceKm<=max)
      .sort((a,b)=>{
        if(a._distanceKm==null&&b._distanceKm==null)return 0;
        if(a._distanceKm==null)return 1;
        if(b._distanceKm==null)return -1;
        return a._distanceKm-b._distanceKm;
      });
  };

  window.MNTYLocationContract={ranges:RANGES,state:()=>({...state}),setRange,request,subscribe,distanceKm,filterAndRank};
})();