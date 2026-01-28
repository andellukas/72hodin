if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(()=>{});
}

document.getElementById('app').innerHTML = `
  <h1>72 hodin – Tábor</h1>
  <p>Připravenost na krizové situace.</p>
`;
