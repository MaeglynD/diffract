export const INTERACTIONS={
 michelson:{kind:'parameter',label:'Mirror position',sliderSign:-1,min:-.5,max:.5,step:.001,initial:.12,period:18},
 grin:{kind:'parameter',label:'Launch position',min:-2.2,max:2.2,step:.01,initial:1.8,period:24},
 absorber:{kind:'parameter',label:'Relative phase',min:0,max:2*Math.PI,step:.005,initial:0,period:18},
 'phase-microscope':{kind:'comparison'},
 'fabry-perot':{kind:'cycle'},'bragg-cavity':{kind:'cycle'},circulator:{kind:'cycle'},tunnelling:{kind:'cycle'},
 coupler:{kind:'distance',label:'Interaction length'}
};
