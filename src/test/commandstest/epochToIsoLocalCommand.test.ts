'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { EpochToIsoLocalCommand } from '../../commands/epochToIsoLocalCommand';
import { StepResult } from '../../step/stepResult';
import { InputFlowAction } from '../../util/InputFlowAction';
import { ResultBox } from '../../util/resultBox';
import { TimeConverter } from '../../util/timeConverter';
import { ExtensionContextMock } from '../mock/extensionContextMock';
import { MultiStepHandlerMock } from '../mock/multiStepHandlerMock';

describe('EpochToIsoLocalCommand', () => {
    let timeConverter: TimeConverter;
    let testObject: EpochToIsoLocalCommand;
    let testEditor: vscode.TextEditor;
    let handlerMock: MultiStepHandlerMock;
    let showResultStub: sinon.SinonStub;

    before(async () => {
        handlerMock = new MultiStepHandlerMock();
        timeConverter = new TimeConverter();
        showResultStub = sinon.stub(ResultBox.prototype, 'show');

        if (vscode.workspace.workspaceFolders !== undefined) {
            const uris = await vscode.workspace.findFiles('*.ts');
            const file = await vscode.workspace.openTextDocument(uris[0]);
            testEditor = await vscode.window.showTextDocument(file);
        }
        const config = vscode.workspace.getConfiguration('timing');
        await config.update('customFormats', []);
    });

    after(async () => {
        const config = vscode.workspace.getConfiguration('timing');
        await config.update('customFormats', undefined);
        await config.update('insertConvertedTime', undefined);
        await config.update('ignoreFocusOut', undefined);
        await config.update('hideResultViewOnEnter', undefined);
        showResultStub.restore();
        handlerMock.restore();
    });

    describe('execute', () => {

        beforeEach('Reset', () => {
            testObject = new EpochToIsoLocalCommand(new ExtensionContextMock(), timeConverter, undefined);
            testEditor.selection = new vscode.Selection(new vscode.Position(3, 32), new vscode.Position(3, 41));
            handlerMock.run.returns(['1000']);
            showResultStub.returns(new StepResult(InputFlowAction.Cancel, undefined));
        });

        afterEach(() => {
            handlerMock.reset();
            showResultStub.resetHistory();
        });

        it('Should not ask for user input if pre selection is valid epoch date', async () => {
            await testObject.execute();

            assert.strictEqual(handlerMock.registerStep.notCalled, true);
            assert.strictEqual(handlerMock.run.notCalled, true);
            assert.strictEqual(showResultStub.calledOnce, true);
        });

        it('Should ask for user input if pre selection is invalid epoch', async () => {
            testEditor.selection = new vscode.Selection(new vscode.Position(5, 0), new vscode.Position(5, 0));

            await testObject.execute();

            assert.strictEqual(handlerMock.registerStep.calledOnce, true);
            assert.strictEqual(handlerMock.run.calledOnce, true);
            assert.strictEqual(showResultStub.calledOnce, true);
        });

        it('Should stop if user canceled during epoch time insertion', async () => {
            testEditor.selection = new vscode.Selection(new vscode.Position(5, 0), new vscode.Position(5, 0));
            handlerMock.run.returns([]);

            await testObject.execute();

            assert.strictEqual(handlerMock.run.calledOnce, true);
            assert.strictEqual(handlerMock.registerStep.calledOnce, true);
            assert.strictEqual(showResultStub.notCalled, true);
        });

        it('Should show result after calculation', async () => {
            await testObject.execute();

            assert.strictEqual(handlerMock.run.notCalled, true);
            assert.strictEqual(handlerMock.registerStep.notCalled, true);
            assert.strictEqual(showResultStub.calledOnce, true);
            assert.strictEqual(
                showResultStub.args[0][2],
                timeConverter.epochToIsoLocal('123456789000'));
        });

        it('Should insert the converted time.', async () => {
            const config = vscode.workspace.getConfiguration('timing');
            await config.update('insertConvertedTime', true);
            const priorText = testEditor.document.getText(testEditor.selection);
            const spy = sinon.spy(testEditor, 'edit');

            await testObject.execute();

            assert.strictEqual(handlerMock.run.notCalled, true);
            assert.strictEqual(handlerMock.registerStep.notCalled, true);
            assert.strictEqual(showResultStub.calledOnce, true);
            assert.strictEqual(spy.calledOnce, true);

            // Restore
            const success = await testEditor.edit((editBuilder: vscode.TextEditorEdit) => {
                editBuilder.replace(testEditor.selection, priorText);
            });
            assert.strictEqual(success, true);
            spy.restore();
        });
    });
});
