const blockPrototype =
{
    collection: {
        'run': [
            'runfile',
            'conditionfile',
        ]
    },
    blocks: {
        Int: {
            type: "number",
            value: 0
        },
        NormalString: {
            type: "string",
            value: "NormalString_default"
        },
        Snapshot: {
            type: "snapshot",
            value: ""
        },
        MultiString: {
            type: "multi_string",
            value: "MultiString_default"
        },
        Runfile: {
            type: "edit_able_droplist",
            options: [
                ["", ""],
                ["1", "1"],
            ],
            value: ""
        },
        Runtype: {
            type: "edit_able_droplist",
            options: [
                ["", ""],
                ["1", "1"],
                ["2", "2"],
                ["3", "3"],
            ],
            value: ""
        },
        runfile: {
            type: 'runfile',
            message: '%1 \n%2 \n%3 %r%4 ',
            args: [
                { name: 'text', type: 'MultiString', value: 'comment' },
                { name: 'filename', type: 'Runfile', value: 'a.py' },
                { name: 'runtype', type: 'Runtype', value: '', omitted: true },
                { name: 'snapshot', type: 'Snapshot', value: '', omitted: true },
            ],
            typename: null,
            checkType: 'args',
            linkTo: [
                { name: 'next', direct: 'down', position:'d5', range: 'run', target: 'previous' }
            ],
            linkFrom: [
                { name: 'previous', direct: 'up', position:'u5', range: 'run' }
            ],
        },
        conditionfile: {
            type: 'conditionfile',
            message: '%1 \n%2 \n%5 %r%6 %t2 \n%3 %r%4 ',
            args: [
                { name: 'text', type: 'MultiString', value: 'comment' },
                { name: 'filename', type: 'Runfile', value: 'a.py' },
                { name: 'runtype', type: 'Runtype', value: '', omitted: true },
                { name: 'snapshot', type: 'Snapshot', value: '', omitted: true },
                { name: 'condition', type: 'NormalString', value: 'c.txt' },
                { name: 'maxCount', type: 'Int', value: 10, description: '0 for no limit', omitted: true },
            ],
            typename: null,
            checkType: 'args',
            linkTo: [
                { name: 'next', direct: 'down', position:'d5', range: 'run', target: 'previous' },
                { name: 'drop', direct: 'right', range: 'run', target: 'previous', nodepend: true }
            ],
            linkFrom: [
                { name: 'previous', direct: 'up', position:'u5', range: 'run' }
            ],
        }
    }
}

// export default blockPrototype
if (typeof exports === 'undefined') { globalThis.exports = globalThis }
exports.blockPrototype = blockPrototype;