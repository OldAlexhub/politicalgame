import {BASE_CONTENT,BASE_POLICY,canonicalJson,createWorld,adoptArtifacts,validateArtifacts} from '../packages/simulation';
import {verifyArtifact,SignedArtifact} from '../src/living/artifacts';
const crypto=require('node:crypto');
const {Buffer}=require('node:buffer');
test('signed content survives JSON key reordering but rejects tampering and incompatible engines',()=>{
  const keys=crypto.generateKeyPairSync('ed25519');
  const payload={...BASE_CONTENT,version:'2.0.1'};
  const checksum=crypto.createHash('sha256').update(canonicalJson(payload)).digest('hex');
  const signature=crypto.sign(null,Buffer.from(checksum),keys.privateKey).toString('base64');
  const publicKey=keys.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64');
  const artifact:SignedArtifact={kind:'content',payload:JSON.parse(canonicalJson(payload)),checksum,signature};
  expect(verifyArtifact(artifact,publicKey)).toBe(artifact);
  expect(()=>verifyArtifact({...artifact,payload:{...payload,version:'2.0.9'}},publicKey)).toThrow('signature');
  expect(()=>verifyArtifact({...artifact,payload:{...payload,engineVersion:'3.0.0'}},publicKey)).toThrow('Incompatible');
});
test('policy gates reject invalid weights and checkpoint adoption preserves obligations',()=>{
  expect(()=>validateArtifacts(BASE_CONTENT,{...BASE_POLICY,weights:{...BASE_POLICY.weights,organize:NaN}})).toThrow();
  const s=createWorld({seed:88});const next=adoptArtifacts(s,{...BASE_CONTENT,version:'2.0.1'},BASE_POLICY);
  expect(next.contentVersion).toBe('2.0.1');expect(next.treasury).toBe(s.treasury);expect(next.config.contentVersion).toBe(s.contentVersion);expect(s.contentVersion).toBe('2.0.0');
});
