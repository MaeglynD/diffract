import {conveyorPhase} from './optical-conveyor.js';
import {JET} from './nanojet.js';
import {SCHLIEREN} from './schlieren.js';
export const INTERACTIONS={
 nanojet:{kind:'parameter',sampleScan:true,label:'Scan across the jet',min:-JET.scanHalf,max:JET.scanHalf,step:.005,initial:0,period:16,symbol:'x_{\\rm p}',unit:'lambda',startPaused:true},
 conveyor:{kind:'parameter',phaseArm:'conveyor-right',armPhase:conveyorPhase,label:'Delay carriage',min:-1,max:1,step:.001,initial:0,period:14,symbol:'\\Delta d',unit:'lambda'},
 schlieren:{kind:'parameter',parameterBank:'schlieren-blade',label:'Knife-edge position',min:-SCHLIEREN.bladeLimit,max:SCHLIEREN.bladeLimit,step:.005,initial:0,period:24,symbol:'x_{\\rm k}',unit:'lambda',startPaused:true},
 'speckle-focus':{kind:'comparison',aux:'speckle-focus-bright',choices:['Uncorrected','Focused'],label:'Wavefront correction'},
 hartmann:{kind:'comparison',aux:'hartmann-bright',choices:['Flat wave','Astigmatic'],label:'Incident wavefront'},
 'sound-cell':{kind:'parameter',label:'Acoustic drive',min:0,max:2.7,step:.005,initial:1.72,period:18,symbol:'d',unit:'rad'},
 'light-billiard':{kind:'parameter',label:'Mode mixing',min:0,max:Math.PI/2,step:.002,initial:.13,period:26,symbol:'\\chi',unit:'angle'},
 coronagraph:{kind:'comparison',aux:'coronagraph-bright',choices:['On axis','Off axis'],label:'Star alignment',planes:[[28,'Vortex'],[55.5,'Lyot pupil'],[70,'Camera']]},
 michelson:{kind:'parameter',label:'Mirror position',sliderSign:-1,min:-.5,max:.5,step:.001,initial:.12,period:18},
 grin:{kind:'parameter',label:'Launch position',min:-2.2,max:2.2,step:.01,initial:1.8,period:24},
 absorber:{kind:'parameter',label:'Relative phase',min:0,max:2*Math.PI,step:.005,initial:0,period:18},
 'phase-microscope':{kind:'comparison',aux:'phase-microscope-bright',choices:['Phase contrast','Bright field'],label:'Microscope contrast',planes:[[.5,'Specimen'],[40,'Fourier plane'],[80,'Image']]},
 'fabry-perot':{kind:'cycle'},'bragg-cavity':{kind:'cycle'},circulator:{kind:'cycle'},tunnelling:{kind:'cycle'},
 coupler:{kind:'distance',label:'Interaction length'}
};
