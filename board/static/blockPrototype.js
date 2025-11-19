export const blockPrototype =
{
    blocks: {
        NormalString: {
            type: "input",
            value: "NormalString_default"
        },
        MultiString: {
            type: "multi",
            value: "MultiString_default"
        },
        Runtype: {
            type: "droplist",
            options: [
                ["", ""],
                ["1", "1"],
            ],
            value: ""
        },
        runfile: {
            type: 'runfile',
            message: '%1 %2\n%3',
            args: [
                { name: 'filename', type: 'NormalString', value: 'a.py' },
                { name: 'runtype', type: 'Runtype', value: '' },
                { name: 'comment', type: 'MultiString', value: 'comment' },
            ],
            typename: null,
            checkType: 'args',
            linkTo: [
                { name: 'next', position: 'down', range: 'runfile', multi: false }
            ],
            linkFrom: [
                { name: 'previous', position: 'up', range: 'runfile' }
            ],
        }
    }
}