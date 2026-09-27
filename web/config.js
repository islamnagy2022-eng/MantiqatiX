window.MANTIQATIX_CONFIG={};
window.MNTY_SUPPORT={whatsapp:'201010171770'};
window.MNTY_DATA_SOURCE='DISCONNECTED';

(function(){
  const disconnectedError={message:'تم فصل التطبيق عن مصدر البيانات. أعد ربط مصدر بيانات جديد قبل استخدام الحساب والبيانات.'};
  const blockedQuery=()=>{throw new Error(disconnectedError.message)};
  window.supabase={
    createClient:function(){
      return {
        auth:{
          getSession:async()=>({data:{session:null},error:null}),
          getUser:async()=>({data:{user:null},error:null}),
          signInWithOtp:async()=>({data:null,error:disconnectedError}),
          verifyOtp:async()=>({data:null,error:disconnectedError}),
          signOut:async()=>({error:null}),
          onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
        },
        from:blockedQuery,
        functions:{invoke:async()=>({data:null,error:disconnectedError})},
        storage:{from:blockedQuery}
      };
    }
  };
  try{
    localStorage.removeItem('MNTYActiveMembershipId');
    localStorage.removeItem('MNTYAuthState');
  }catch(_){}
})();
