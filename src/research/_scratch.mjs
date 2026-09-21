
for(let b=245;b<=257;b++){ const r=macdCross(vshape(b,260,300,100)); console.log('V bottom',b, JSON.stringify(r)) }
for(let t=245;t<=257;t++){ const r=macdCross(invv(t,260,300,100)); console.log('^ top',t, JSON.stringify(r)) }
