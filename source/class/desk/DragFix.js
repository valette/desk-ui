/**
 * Singleton to fix drag issues ( see https://github.com/qooxdoo/qooxdoo/issues/9289 )
 * the fix is to add the following line : 
 * desk.DragFix.getInstance().focus();
 * after a dragstart event on an other widget
 */
qx.Class.define("desk.DragFix", 
{
	extend : qx.ui.form.TextField,

	type : "singleton",

	construct : function() {

		this.base(arguments);

		this.set( {
			width: 0,
			height: 0,
			decorator: null,
			zIndex: -1
		} );

		qx.core.Init.getApplication().getRoot().add( this, { left : 0, top : 0} );

	}

} );
