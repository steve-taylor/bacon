import propTypes from 'prop-types';

import hydrate from '../../../../src/hydrate';
import isomorphic from '../../../../src/isomorphic';

import WithChildren from '../components/with-children';
import WithChildrenContext from '../../context/with-children-context';
import getData from '../../iso-streams/very-simple';

const isoWithChildren = {
    name: 'iso-with-children--connected',
    component: WithChildren,
    context: WithChildrenContext,
    getData,
    propTypes: {
        power: propTypes.number,
    },
};

export const IsoWithChildren = isomorphic(isoWithChildren);

export function hydrateWithChildren(options) {
    hydrate(IsoWithChildren, options);
}
