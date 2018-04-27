(function ($) {
    jQuery.fn.yiiUploadKit = function (options) {
        var $input = this;
        var $container = $input.parent('div');
        var $files = $('<ul>', {"class": "files"}).insertBefore($input);
        var $emptyInput = $container.find('.empty-value');

        var methods = {
            init: function () {
                if (options.multiple) {
                    $input.attr('multiple', true);
                    $input.attr('name', $input.attr('name') + '[]');
                }
                $container.addClass('upload-kit');
                if (options.sortable) {
                    $files.sortable({
                        placeholder: "upload-kit-item sortable-placeholder",
                        tolerance: "pointer",
                        forcePlaceholderSize: true,
                        update: function () {
                            methods.updateOrder()
                        }
                    })
                }
                if (options.required) {
                    $input.attr('aria-required', 'true');
                }
                $input.wrapAll($('<li class="upload-kit-input"></div>'))
                    .after($('<span class="glyphicon glyphicon-plus-sign add"></span>'))
                    .after($('<span class="glyphicon glyphicon-circle-arrow-down drag"></span>'))
                    .after($('<span/>', {
                        "data-toggle": "popover",
                        "class": "glyphicon glyphicon-exclamation-sign error-popover"
                    }))
                    .after(
                        '<div class="progress">' +
                        '<div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>' +
                        '</li>'
                    );
                $files.on('click', '.upload-kit-item .remove', methods.removeItem);
                $files.on('click', '.ada-upload-item-delete', function () {
                    var index = $(this).attr('item');
                    var remove = methods.removeItem.bind($('.upload-kit-item .remove[item=' + index + ']'));
                    remove();
                });
                methods.checkInputVisibility();
                methods.fileuploadInit();
                methods.dragInit();
                if (options.acceptFileTypes && !(options.acceptFileTypes instanceof RegExp)) {
                    options.acceptFileTypes = new RegExp(eval(options.acceptFileTypes))
                }

            },
            fileuploadInit: function () {
                var $fileupload = $input.fileupload({
                    name: options.name || 'file',
                    url: options.url,
                    dropZone: $input.parents('.upload-kit-input'),
                    dataType: 'json',
                    singleFileUploads: false,
                    multiple: options.multiple,
                    maxNumberOfFiles: options.maxNumberOfFiles,
                    maxFileSize: options.maxFileSize, // 5 MB
                    acceptFileTypes: options.acceptFileTypes,
                    minFileSize: options.minFileSize,
                    messages: options.messages,
                    process: true,
                    getNumberOfFiles: methods.getNumberOfFiles,
                    start: function (e, data) {
                        $container.find('.upload-kit-input')
                            .removeClass('error')
                            .addClass('in-progress');
                        $input.trigger('start');
                        if (options.start !== undefined) options.start(e, data);
                    },
                    processfail: function (e, data) {
                        if (data.files.error) {
                            methods.showError(data.files[0].error);
                        }
                    },
                    progressall: function (e, data) {
                        var progress = parseInt(data.loaded / data.total * 100, 10);
                        $container.find('.progress-bar').attr('aria-valuenow', progress).css(
                            'width',
                            progress + '%'
                        ).text(progress + '%');
                    },
                    done: function (e, data) {
                        $.each(data.result.files, function (index, file) {
                            if (!file.error) {
                                var item = methods.createItem(file);
                                item.appendTo($files);
                                $files.append('<a href="javascript:void(0)" class="ada-upload-item-delete invisible_ada" item="' + (methods.getNumberOfFiles() - 1) + '" aria-label="remove upload file">remove file</a>');
                            } else {
                                methods.showError(file.errors)
                            }

                        });
                        methods.handleEmptyValue();
                        methods.checkInputVisibility();
                        $input.trigger('done');
                        if (options.done !== undefined) options.done(e, data);
                    },
                    fail: function (e, data) {
                        methods.showError(data.errorThrown);
                        if (options.fail !== undefined) options.fail(e, data);
                    },
                    always: function (e, data) {
                        $container.find('.upload-kit-input').removeClass('in-progress');
                        $input.trigger('always');
                        if (options.always !== undefined) options.always(e, data);
                        methods.focusBlock();
                    }

                });
                if (options.files) {
                    options.files.sort(function (a, b) {
                        return parseInt(a.order) - parseInt(b.order);
                    });
                    $fileupload.fileupload('option', 'done').call($fileupload, $.Event('done'), {result: {files: options.files}});
                    methods.handleEmptyValue();
                    methods.checkInputVisibility();
                }
            },
            dragInit: function () {
                $(document).on('dragover', function () {
                    $('.upload-kit-input').addClass('drag-highlight');
                });
                $(document).on('dragleave drop', function () {
                    $('.upload-kit-input').removeClass('drag-highlight');
                });
            },
            showError: function (error) {
                if ($.fn.popover) {
                    $container.find('.error-popover').attr('data-content', error).popover({
                        html: true,
                        trigger: "hover"
                    });
                }
                $container.find('.upload-kit-input').addClass('error');
            },
            removeItem: function (e) {
                var $this = $(this);

                var confirm=bootbox.confirm({
                    message: "<div class=\"line-height-1-5\">Do you want to delete a file?</div>",
                    className: 'main-body-container',
                    buttons: {
                        confirm: {
                            label: 'Yes',
                            className: 'btn btn-primary btn-save'
                        },
                        cancel: {
                            label: 'No',
                            className: 'btn btn-default'
                        }
                    },
                    callback: function (result) {
                        var promise = $.when();

                        if (result) {
                            var url = $this.data('url');
                            var form = $this.parents('form');
                            if (url) {
                                promise = $.ajax({
                                    url: url,
                                    type: 'DELETE'
                                });
                            }
                            $.when(promise).always(function () {
                                var container = $this.parents('.input_container');
                                $this.parents('.upload-kit-item').remove();
                                $(".ada-upload-item-delete[item=" + $this.attr('item') + "]").remove();
                                methods.handleEmptyValue();
                                methods.checkInputVisibility();

                                if (options.formBuilder) {
                                    var id = container.attr('n');
                                    var form_data_id = $('#form').attr('form_data_id');
                                    if (id == undefined) {
                                        return;
                                    }
                                    $.ajax({
                                        url: '/forms/delete-item-file',
                                        type: 'POST',
                                        data: {'id': id, 'form_data_id': form_data_id},
                                        success: function (response) {
                                            if (response.success) {
                                                if (options.always !== undefined) options.always();
                                                container.find('.forms-download-file').remove();
                                            } else {
                                                if (typeof response.errors.val) {
                                                    help_block.html(response.errors.val);
                                                }
                                            }
                                            methods.focusBlock();
                                        }
                                    });
                                } else {
                                    $.ajax({
                                        url: form.attr('action'),
                                        type: 'POST',
                                        data: form.serialize(),
                                        success: function (response) {
                                            if (options.always !== undefined) options.always();
                                            methods.focusBlock();
                                        }
                                    });
                                }
                            });
                        } else {
                            //methods.focusBlock();
                            setTimeout(function() { $container.find('.ada-upload-item-delete').focus(); }, 1000);
                        }
                    }
                });
                confirm.init(function(){
                    var b=$('.bootbox-confirm');
                    b.attr('aria-label',b.find('.bootbox-body').html());
                });
            },
            createItem: function (file) {
                var name = options.name;
                var index = methods.getNumberOfFiles();
                if (options.multiple) {
                    name += '[' + index + ']';
                }
                var item = $('<li>', {"class": "upload-kit-item done", "item": index})
                    .append($('<input/>', {"name": name + '[name]', "value": file.name, "type": "hidden"}))
                    .append($('<input/>', {"name": name + '[size]', "value": file.size, "type": "hidden"}))
                    .append($('<input/>', {"name": name + '[type]', "value": file.type, "type": "hidden"}))
                    .append($('<input/>', {
                        "name": name + '[order]',
                        "value": file.order,
                        "type": "hidden",
                        "data-role": "order"
                    }))
                    .append($('<span/>', {
                        "class": "glyphicon glyphicon-remove-circle remove",
                        "data-url": file.delete_url,
                        "item": index
                    }));
                if (options.formBuilder) {
                    item.append($('<input/>', {"name": name + '[path]', "value": file.path, "type": "hidden"}))
                        .append($('<input/>', {"name": name + '[base_url]', "value": file.base_url, "type": "hidden"}))
                        .append($('<span/>', {"class": "name", "title": file.name}));
                    var name_arr = file.name.split('.');
                    var ext = name_arr[name_arr.length - 1];
                    $container.attr('ext', ext);
                    methods.afterRemoveItem(item, file, options, file.base_url, file.path);
                } else {
                    item.append($('<input/>', {
                        "name": name + '[' + options.pathAttributeName + ']',
                        "value": file[options.pathAttribute],
                        "type": "hidden"
                    }))
                        .append($('<input/>', {
                            "name": name + '[' + options.baseUrlAttributeName + ']',
                            "value": file[options.baseUrlAttribute],
                            "type": "hidden"
                        }))
                        .append($('<span/>', {
                            "class": "name",
                            "title": file.name,
                            "text": options.showPreviewFilename ? file.name : null
                        }));
                    methods.afterRemoveItem(item, file, options, file[options.baseUrlAttribute], file[options.pathAttribute]);
                }
                return item;
            },
            afterRemoveItem: function (item, file, options, base_url, path) {
                if ((!file.type || file.type.search(/image\/.*/g) !== -1) && options.previewImage) {
                    item.removeClass('not-image').addClass('image');
                    item.prepend($('<img/>', {src: base_url + '/' + path, alt: options.altImgName}));
                    item.find('span.type').text('');
                } else {
                    item.removeClass('image').addClass('not-image');
                    item.css('backgroundImage', '');
                    item.find('span.name').text(file.name);
                }
                return item;
            },
            focusBlock: function () {
                setTimeout(function() { $container.parent().parent().parent().focus(); }, 1000);
            },
            checkInputVisibility: function () {
                var inputContainer = $container.find('.upload-kit-input');
                if (options.maxNumberOfFiles && (methods.getNumberOfFiles() >= options.maxNumberOfFiles)) {
                    inputContainer.hide();
                } else {
                    inputContainer.show();
                }
            },
            handleEmptyValue: function () {
                if (methods.getNumberOfFiles() > 0) {
                    $emptyInput.val(methods.getNumberOfFiles());
                } else {
                    $emptyInput.removeAttr('value');
                }
            },
            getNumberOfFiles: function () {
                return $container.find('.files .upload-kit-item').length;
            },
            updateOrder: function () {
                $files.find('.upload-kit-item').each(function (index, item) {
                    $(item).find('input[data-role=order]').val(index);
                });
            }
        }
        methods.init.apply(this);
        return this;
    };

})(jQuery);
