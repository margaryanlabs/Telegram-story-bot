/* VETO local voice transformation: two Hann-windowed delay heads.
 * No server call, speech recognition, voice identity synthesis or persistence.
 * Output is pitch-shifted audio with its approximate original duration.
 * Intended for voice notes, not clinical or security-grade anonymisation.
 */
class VetoPitchShifter extends AudioWorkletProcessor {
  constructor(options){
    super();
    const raw=Number(options?.processorOptions?.factor||1);
    this.factor=Number.isFinite(raw)?Math.max(0.74,Math.min(1.32,raw)):1;
    this.length=16384;
    this.ring=new Float32Array(this.length);
    this.write=0;
    this.phase=0;
    this.span=2400;
    this.baseDelay=640;
    this.phaseStep=Math.abs(1-this.factor)/this.span;
  }
  readAt(delay){
    let at=this.write-delay;
    while(at<0)at+=this.length;
    const lower=Math.floor(at)%this.length;
    const next=(lower+1)%this.length;
    const fraction=at-Math.floor(at);
    return this.ring[lower]*(1-fraction)+this.ring[next]*fraction;
  }
  process(inputs,outputs){
    const input=inputs[0]?.[0],out=outputs[0]?.[0];
    if(!out)return true;
    for(let i=0;i<out.length;i++){
      const sample=Number.isFinite(input?.[i])?input[i]:0;
      this.ring[this.write]=sample;
      const a=this.phase,b=(a+.5)%1;
      const delayA=this.baseDelay+(this.factor<1?a:1-a)*this.span;
      const delayB=this.baseDelay+(this.factor<1?b:1-b)*this.span;
      const wa=.5-.5*Math.cos(2*Math.PI*a);
      const wb=1-wa;
      const y=wa*this.readAt(delayA)+wb*this.readAt(delayB);
      out[i]=Math.max(-1,Math.min(1,Number.isFinite(y)?y:0));
      this.write=(this.write+1)%this.length;
      this.phase+=this.phaseStep;
      if(this.phase>=1)this.phase-=1;
    }
    for(let channel=1;channel<outputs[0].length;channel++){
      outputs[0][channel].set(out);
    }
    return true;
  }
}
registerProcessor('veto-pitch-shifter',VetoPitchShifter);
