
/* ************************************************************************

   Copyright:

   License:

   Authors:

************************************************************************ */

qx.Theme.define("desk.theme.Decoration",
{
  extend : qx.theme.indigo.Decoration,

  decorations :
  {
		"window" :
		{
		  decorator : [
			qx.ui.decoration.MSingleBorder,
			qx.ui.decoration.MBorderRadius,
			qx.ui.decoration.MBackgroundColor
		  ],

		  style :
		  {
			radius: 6,
			width: 1,
			color: "window-border",
			shadowLength: 1,
			shadowBlurRadius: 3,
			shadowColor: "shadow",
			backgroundColor: "background",
		  }
		},
		"button-box" :
		{
		  decorator : [
			qx.ui.decoration.MSingleBorder,
			qx.ui.decoration.MBorderRadius,
			qx.ui.decoration.MBackgroundColor
		  ],

		  style :
		  {
			radius: 5,
			color: "#CCCCCC",
			backgroundColor:"#F0F0F0",
			width: 1
		  }
		},
		"button-box-pressed" :
		{
		  include : "button-box",
		  style :
		  {
			  radius: 5,
			  backgroundColor:"#CCCCCC",
			  width: 1
		  }
		},
		"button-box-hovered" :
		{
		  include : "button-box",
		  style :
		  {
			  color: "black",
			  backgroundColor:"#DDDDDD",
		  }
		}
  }
});
