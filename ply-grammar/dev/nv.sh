#!/bin/bash
# nv.sh prefix  -> screenshots of the four note views on the user's design, colour look, pins off
cd /tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad
PRE="(()=>{__S.look='color';__xp.getNotes().length=0;__rebuild();return null})()" DSF=2 python3 vw.py d_user.json ${1}1:-3.26,40.96,21.99:10.83,18.62,5.65 ${1}1b:2,22,10:4.08,11.68,1.17 ${1}2:15.94,24.12,42.83:8.23,8.73,10.95 ${1}2b:10,12,24:3.48,3.79,10.55 ${1}3:7.95,-22.23,32.74:0.65,2.96,11.17 ${1}3b:4,-10,20:0.98,0,10.37 ${1}4:37.89,40.36,-34.23:0.65,2.96,11.17 ${1}4b:20,30,-24:8.45,20.7,-12.13
