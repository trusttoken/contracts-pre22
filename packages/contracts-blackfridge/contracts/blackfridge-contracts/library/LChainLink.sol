//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library LChainLink {
    struct Link {
        bytes32 id;
        bytes32 next;
        bytes32 pre;
    }

    bytes32 internal constant SENTINEL_ID =
        bytes32(
            0x0000000000000000000000000000000000000000000000000000000000000001
        );

    address internal constant SENTINEL_ADDR = address(0x1);

    //////////////////// for bytes32

    function _isEmpty(bytes32 id) internal pure returns (bool) {
        if (id == bytes32(0x0) || id == SENTINEL_ID) {
            return true;
        }

        return false;
    }

    function _isEmpty(Link storage link) internal view returns (bool) {
        if (
            link.id == bytes32(0x0) ||
            (link.next == link.pre && link.next == bytes32(0x0))
        ) {
            return true;
        }

        return false;
    }

    function _init(Link storage link) internal {
        if (!_isEmpty(link)) {
            return;
        }

        link.id = SENTINEL_ID;
        link.next = SENTINEL_ID;
        link.pre = SENTINEL_ID;
    }

    function _addItemLink(
        Link storage item,
        Link storage sentinel,
        Link storage next,
        bytes32 itemID
    ) internal {
        require(
            sentinel.next == next.id && next.pre == SENTINEL_ID,
            "add link error"
        );

        item.id = itemID;
        item.next = sentinel.next;
        item.pre = SENTINEL_ID;

        next.pre = itemID;
        sentinel.next = itemID;
    }

    function _delItemLink(
        Link storage item,
        Link storage pre,
        Link storage next
    ) internal {
        require(pre.next == item.id && next.pre == item.id, "del link error");
        item.id = bytes32(0x0);
        item.next = bytes32(0x0);
        item.pre = bytes32(0x0);

        pre.next = next.id;
        next.pre = pre.id;
    }

    function _getNextID(Link storage item) internal view returns (bytes32) {
        // require(item.next != bytes32(0x0), "get link next error");
        return item.next;
    }

    function _getPreID(Link storage item) internal view returns (bytes32) {
        // require(item.pre != bytes32(0x0), "get link pre error");
        return item.pre;
    }

    //////////////////// for address
    function _isEmpty(address addr) internal pure returns (bool) {
        return _isEmpty(bytes32(uint256(uint160(addr))));
    }

    function _addItemLink(
        Link storage item,
        Link storage sentinel,
        Link storage next,
        address itemAddr
    ) internal {
        _addItemLink(item, sentinel, next, bytes32(uint256(uint160(itemAddr))));
    }

    function _getNextAddr(Link storage item) internal view returns (address) {
        return address(uint160(uint256(_getNextID(item))));
    }

    function _getPreAddr(Link storage item) internal view returns (address) {
        return address(uint160(uint256(_getPreID(item))));
    }
}
