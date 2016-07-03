/**
 * A text editor that can also execute javascript code
 * @lint ignoreDeprecated (alert)
 */
qx.Class.define("desk.TabTextEditor",
{
  extend : qx.core.Object,

	/**
	* Creates a new text editor
	*
	* @param file {String} the file to edit
	*/
	construct : function(file) {
	    this.base(arguments);
        var win = desk.TabTextEditor.win;
        if (!win) {
    		win = desk.TabTextEditor.win = new qx.ui.window.Window();
    		win.set({layout : new qx.ui.layout.VBox(),
    			height :700, width : 700, showMinimize : false});
    		win.addListener('close',this.__clean, this);
    		win.setCaption("Desk Text Editor");
    		win.add(new desk.TabView(), {flex : 1});
    		win.open();
    		win.center();
        }

        var found = false;
	    desk.TabTextEditor.win.getChildren()[0].getChildren().forEach(function (e) {
	        if (e.getLabel() === file) {
	            found = true;
                e.getButton().execute();
	        }
	    });

        if (found) return;

        var editor = new desk.TextEditor(file, {standalone : false});
        var element = win.getChildren()[0].addElement(file,editor);
        element.getButton().execute();
        element.setShowCloseButton(true);
        element.show();
        element.addListener('close', editor.destroy, editor);
	},

	statics : {
		win : null
	},

	members : {
        __window : null,

        __clean : function() {
    	    desk.TabTextEditor.win.getChildren()[0].getChildren().forEach(
	        function (e) {
	            e.destroy();
	        });
	        desk.TabTextEditor.win.destroy();
	        desk.TabTextEditor.win = 0;
        }
	}
});
