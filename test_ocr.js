const excludedNumbers = ['30324012', '+584128093645'];
const text = `
¡Listo!
Tu Tpago fue exitoso
Monto (Bs.):
842,00
Nro. de referencia:
522638915301
Fecha y hora del envío:
14/08/2026 a las 10:51:44 PM
Cuenta origen:
Cta. Ahorro *2229
Beneficiario:
0412-8093645
Documento de identidad:
V-30.324.012
Banco destino:
0102 - Banco De Venezuela
`;

const refMatch = text.match(/ref[a-z]*[^0-9]{0,15}(\d{6,})/i);
if (refMatch && refMatch[1]) {
  console.log("OCR Encontrado por palabra clave 'ref':", refMatch[1].slice(-6));
} else {
  let digitSequences = text.match(/\d{6,}/g);
  console.log("Found digit sequences:", digitSequences);
  
  if (!digitSequences || digitSequences.length === 0) {
    console.log("No sequences found");
  } else {
    const normalizedExclusions = excludedNumbers
      .filter(Boolean)
      .map(num => String(num).replace(/\D/g, ''))
      .filter(numStr => numStr.length >= 6);
      
    console.log("Normalized Exclusions:", normalizedExclusions);
    
    if (normalizedExclusions.length > 0) {
      digitSequences = digitSequences.filter(seq => {
        return !normalizedExclusions.some(exclusion => seq.includes(exclusion) || exclusion.includes(seq));
      });
    }
    
    console.log("Filtered sequences:", digitSequences);
    if (digitSequences.length > 0) {
      digitSequences.sort((a, b) => b.length - a.length);
      console.log("Best match:", digitSequences[0], "->", digitSequences[0].slice(-6));
    }
  }
}
