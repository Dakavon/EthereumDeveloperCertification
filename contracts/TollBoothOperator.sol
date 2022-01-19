// SPDX-License-Identifier: Unlicense

//B9lab ETH-SUB Ethereum Developer Subscription Course
//>>> Exam <<<
//
//Last update: 07.03.2021

pragma solidity ^0.5.0;

import "./Pausable.sol";
import "./DepositHolder.sol";
import "./TollBoothHolder.sol";
import "./MultiplierHolder.sol";
import "./RoutePriceHolder.sol";
import "./Regulated.sol";
import "./PullPayment.sol";
import "./interfaces/TollBoothOperatorI.sol";

import "./SafeMath.sol";


/**
 * @title TollBoothOperator
 *
 * - a contract named `TollBoothOperator` that:
 *     - is `OwnedI`, `PausableI`, `DepositHolderI`, `TollBoothHolderI`,
 *         `MultiplierHolderI`, `RoutePriceHolderI`, `RegulatedI`, `PullPaymentA`, and `TollBoothOperatorI`.
 */
contract TollBoothOperator is
    Pausable, DepositHolder, TollBoothHolder, MultiplierHolder, RoutePriceHolder, Regulated, PullPayment, TollBoothOperatorI{

    using SafeMath for uint;

    /*
     * VehicleStatus keeps track of the life phases of the vehicles journey
     */
    enum VehicleStatus{
        none,
        hasEntered,
        hasLeft,
        hasPaid
    }

    /*
     * VehicleEntry is an internal struct for the vehicles usage of a toll road
     * Information can be retrieved by getVehicleEntry()
     */
    struct VehicleEntry{
        address vehicle;
        address entryBooth;
        uint multiplier;
        uint depositedWeis;
        VehicleStatus status;
    }
    mapping (bytes32 => VehicleEntry) private vehicleEntries;

    /*
     * EntryExitPair is an internal struct (for each entry-exit-booth combination)
     * to realise FIFO pending payments through a linked list
     *
     * - firstPendingPaymentHash points to the first PendingPayment struct,
     *      which needs to be updated if the queue is decreased
     * - lastPendingPaymentHash points to the last PendingPayment struct,
     *      which needs to be updated if the queue is extended
     */
    struct EntryExitPair{
        uint pendingPaymentCount;
        bytes32 firstPendingPaymentHash;
        bytes32 lastPendingPaymentHash;
    }
    mapping (address => mapping (address => EntryExitPair)) private entryExitPairs;

    /*
     * PendingPayment is an internal struct for pending payments
     *  where each item points to the next item in a FIFO order in nextPendingPaymentHash
     * Consequently the last PendingPayment item points to 0x0
     * - exitSecretHashed is the hash of the respective VehicleEntry
     */
    struct PendingPayment{
        bytes32 exitSecretHashed;
        bytes32 nextPendingPaymentHash;
    }
    mapping (bytes32 => PendingPayment) private pendingPayments;


    /**
     * - has a constructor that takes:
     *   - one `bool` parameter, the initial paused state.
     *   - one `uint` parameter, the initial deposit wei value, which cannot be 0.
     *   - one `address` parameter, the initial regulator, which cannot be 0.
     */
    constructor(bool initialIsPaused, uint initialbaseDepositWeis, address initialRegulator)
        Pausable(initialIsPaused)
        DepositHolder(initialbaseDepositWeis)
        Regulated(initialRegulator)
        public {}


    /**
     * - a fallback function that rejects all incoming calls.
     */
    function() external {
        revert();
    }


    /**
     * This provides a single source of truth for the encoding algorithm.
     * It will be called:
     *     - by the vehicle prior to sending a deposit.
     *     - by the contract itself when submitted a clear password by a toll booth.
     * @param secret The secret to be hashed. Passing a `0` secret is a valid input.
     * @return the hashed secret.
     */
    function hashSecret(bytes32 secret) view public returns(bytes32 hashed){
        return keccak256(abi.encodePacked(secret, address(this)));
    }


    /**
     * Called by the vehicle entering a road system.
     * Off-chain, the entry toll booth will open its gate after a successful deposit and a confirmation
     * of the vehicle identity.
     *     It should roll back when the contract is in the `true` paused state.
     *     It should roll back when the vehicle is not a registered vehicle.
     *     It should roll back when the vehicle is not allowed on this road system.
     *     It should roll back if `entryBooth` is not a tollBooth.
     *     It should roll back if less than deposit * multiplier was sent alongside.
     *     It should roll back if `exitSecretHashed` has previously been used by anyone to enter.
     *     It should be possible for a vehicle to enter "again" before it has exited from the
     *       previous entry.
     * @param entryBooth The declared entry booth by which the vehicle will enter the system.
     * @param exitSecretHashed A hashed secret that when solved allows the operator to pay itself.
     * @return Whether the action was successful.
     * Emits LogRoadEntered with:
     *     The sender of the action.
     *     The address of the entry booth.
     *     The hashed secret used to deposit.
     *     The multiplier of the vehicle at entry.
     *     The amount deposited by the vehicle.
     */
    function enterRoad(address entryBooth, bytes32 exitSecretHashed) public payable whenNotPaused returns (bool success){
        uint vehicleType = getRegulator().getVehicleType(msg.sender);
        require(vehicleType != 0, "TollBoothOperator: Vehicle is not a registered vehicle");

        uint multiplier = getMultiplier(vehicleType);
        require(multiplier != 0, "TollBoothOperator: Vehicle is not allowed on this road system");

        require(isTollBooth(entryBooth), "TollBoothOperator: entryBooth is not a tollBooth");

        uint baseDepositWeis = getDeposit();
        uint entryDeposit = baseDepositWeis.mul(multiplier);
        require(msg.value >= entryDeposit, "TollBoothOperator: Msg.value is less than the required deposit");

        require(vehicleEntries[exitSecretHashed].status == VehicleStatus.none, "TollBoothOperator: exitSecretHashed has previously been used");

        vehicleEntries[exitSecretHashed].vehicle        = msg.sender;
        vehicleEntries[exitSecretHashed].entryBooth     = entryBooth;
        vehicleEntries[exitSecretHashed].multiplier     = multiplier;
        vehicleEntries[exitSecretHashed].depositedWeis  = msg.value;
        vehicleEntries[exitSecretHashed].status         = VehicleStatus.hasEntered;

        emit LogRoadEntered(msg.sender, entryBooth, exitSecretHashed, multiplier, msg.value);
        return true;
    }


    /**
     * @param exitSecretHashed The hashed secret used by the vehicle when entering the road.
     * @return The information pertaining to the entry of the vehicle.
     *     vehicle: the address of the vehicle that entered the system.
     *     entryBooth: the address of the booth the vehicle entered at.
     *     multiplier: the vehicle's multiplier at entry.
     *     depositedWeis: how much the vehicle deposited when entering.
     * After the vehicle has exited, and the operator has been paid, `depositedWeis` should be returned as `0`.
     *     The `depositedWeis` should remain unchanged while there is a corresponding pending exit.
     * If no vehicles had ever entered with this hash, all values should be returned as `0`.
     */
    function getVehicleEntry(bytes32 exitSecretHashed) view public returns(address vehicle, address entryBooth, uint multiplier, uint depositedWeis){
        vehicle         = vehicleEntries[exitSecretHashed].vehicle;
        entryBooth      = vehicleEntries[exitSecretHashed].entryBooth;
        multiplier      = vehicleEntries[exitSecretHashed].multiplier;
        depositedWeis   = vehicleEntries[exitSecretHashed].depositedWeis;
    }


    /**
     * Called by the exit booth.
     *     It should roll back when the contract is in the `true` paused state.
     *     It should roll back when the sender is not a toll booth.
     *     It should roll back if the exit is same as the entry.
     *     It should roll back if hashing the secret does not match a hashed one.
     *     It should roll back if the secret has already been reported on exit.
     * After a successful exit, the storage should be zeroed out as much as possible.
     * @param exitSecretClear The secret given by the vehicle as it passed by the exit booth. Passing a `0` secret is a valid input.
     * @return status:
     *   1: success, -> emits LogRoadExited with:
     *       The sender of the action.
     *       The hashed secret corresponding to the vehicle trip.
     *       The effective charge paid by the vehicle.
     *       The amount refunded to the vehicle.
     *   2: pending oracle -> emits LogPendingPayment with:
     *       The hashed secret corresponding to the vehicle trip.
     *       The entry booth of the vehicle trip.
     *       The exit booth of the vehicle trip.
     */
    function reportExitRoad(bytes32 exitSecretClear) public whenNotPaused returns (uint status){
        require(isTollBooth(msg.sender), "TollBoothOperator: msg.sender is not a toll booth");

        bytes32 exitSecretHashed = hashSecret(exitSecretClear);

        address entryBooth = vehicleEntries[exitSecretHashed].entryBooth;
        require(entryBooth != msg.sender, "TollBoothOperator: Exit is same as the entry");

        VehicleStatus vehicleStatus = vehicleEntries[exitSecretHashed].status;
        require(vehicleStatus != VehicleStatus.none, "TollBoothOperator: Hashing the secret does not match a hashed one");

        require(vehicleStatus == VehicleStatus.hasEntered, "TollBoothOperator: Secret has already been reported on exit");
        vehicleEntries[exitSecretHashed].status = VehicleStatus.hasLeft;

        uint baseRoutePrice = getRoutePrice(entryBooth, msg.sender);

        if(baseRoutePrice != 0){
            accounting(msg.sender, baseRoutePrice, exitSecretHashed);

            return 1;
        }
        else{
            bytes32 newPendingPaymentHash = keccak256(abi.encodePacked(exitSecretHashed, entryBooth, msg.sender));
            pendingPayments[newPendingPaymentHash].exitSecretHashed = exitSecretHashed;

            EntryExitPair storage thisEntryExitPair = entryExitPairs[entryBooth][msg.sender];

            uint pendingPaymentCount                    = thisEntryExitPair.pendingPaymentCount;
            thisEntryExitPair.pendingPaymentCount       = pendingPaymentCount.add(1);

            if(pendingPaymentCount == 0){
                //Update pointer to the first PendingPayments element
                thisEntryExitPair.firstPendingPaymentHash  = newPendingPaymentHash;
            }
            else{
                //Update pointer of the now penultimate PendingPayments element to the last PendingPayments element
                bytes32 lastPendingPaymentHash = thisEntryExitPair.lastPendingPaymentHash;
                pendingPayments[lastPendingPaymentHash].nextPendingPaymentHash = newPendingPaymentHash;
            }

            thisEntryExitPair.lastPendingPaymentHash    = newPendingPaymentHash;

            emit LogPendingPayment(exitSecretHashed, entryBooth, msg.sender);
            return 2;
        }
    }


    /**
     * @param entryBooth the entry booth that has pending payments.
     * @param exitBooth the exit booth that has pending payments.
     * @return the number of payments that are pending because the price for the
     * entry-exit pair was unknown.
     */
    function getPendingPaymentCount(address entryBooth, address exitBooth) public view returns (uint count){
        return entryExitPairs[entryBooth][exitBooth].pendingPaymentCount;
    }


    /**
     * Can be called by anyone. In case more than 1 payment was pending when the oracle gave a price.
     *     It should roll back when the contract is in `true` paused state.
     *     It should roll back if booths are not really booths.
     *     It should roll back if there are fewer than `count` pending payments that are solvable.
     *     It should roll back if `count` is `0`.
     * After a successful clearing, the storage should be zeroed out as much as possible.
     * @param entryBooth the entry booth that has pending payments.
     * @param exitBooth the exit booth that has pending payments.
     * @param count the number of pending payments to clear for the exit booth.
     * @return Whether the action was successful.
     * Emits LogRoadExited as many times as count, each with:
     *       The address of the exit booth.
     *       The hashed secret corresponding to the vehicle trip.
     *       The effective charge paid by the vehicle.
     *       The amount refunded to the vehicle.
     */
    function clearSomePendingPayments(address entryBooth, address exitBooth, uint count) public whenNotPaused returns (bool success){
        require(isTollBooth(entryBooth) && isTollBooth(exitBooth), "TollBoothOperator: Booths are not really booths");

        uint baseRoutePrice = getRoutePrice(entryBooth, exitBooth);
        require(baseRoutePrice != 0, "TollBoothOperator: A base route price must be given");

        require(count != 0, "TollBoothOperator: Count cannot be 0");

        require(count <= getPendingPaymentCount(entryBooth, exitBooth), "TollBoothOperator: There are fewer than count pending payments");

        for(uint i=0; i<count; i++){
            processPendingPayment(entryBooth, exitBooth, baseRoutePrice);
        }

        return true;
    }


    /**
     * This function is commented out otherwise it prevents compilation of the completed contracts.
     * This function overrides the eponymous function of `RoutePriceHolderI`, to which it adds the following
     * functionality:
     *     - If relevant, it will release 1 pending payment for this route. As part of this payment
     *       release, it will emit the appropriate `LogRoadExited` event.
     *     - It should be possible to call it even when the contract is in the `true` paused state.
     * After a successful clearing, the storage should be zeroed out as much as possible.
     * Emits LogRoadExited, if applicable, with:
     *       The address of the exit booth.
     *       The hashed secret corresponding to the vehicle trip.
     *       The effective charge paid by the vehicle.
     *       The amount refunded to the vehicle.
     */
    function setRoutePrice(address entryBooth, address exitBooth, uint priceWeis) public returns(bool success){
        super.setRoutePrice(entryBooth, exitBooth, priceWeis);

        if(priceWeis > 0 && getPendingPaymentCount(entryBooth, exitBooth) > 0){
            processPendingPayment(entryBooth, exitBooth, priceWeis);
        }

        return true;
    }


    /**
     * An internal support function for process pending payments
     */
    function processPendingPayment(address entryBooth, address exitBooth, uint baseRoutePrice) internal{

        EntryExitPair storage thisEntryExitPair = entryExitPairs[entryBooth][exitBooth];

        bytes32 firstPendingPaymentHash = thisEntryExitPair.firstPendingPaymentHash;

        //Internal support function for accounting
        accounting(exitBooth, baseRoutePrice, pendingPayments[firstPendingPaymentHash].exitSecretHashed);

        bytes32 nextPendingPaymentHash = pendingPayments[firstPendingPaymentHash].nextPendingPaymentHash;

        delete pendingPayments[firstPendingPaymentHash];

        //Update entryExitPair struct
        uint newPendingPaymentCount = (thisEntryExitPair.pendingPaymentCount).sub(1);

        thisEntryExitPair.pendingPaymentCount       = newPendingPaymentCount;
        thisEntryExitPair.firstPendingPaymentHash   = nextPendingPaymentHash;

        if(newPendingPaymentCount == 0){
            delete thisEntryExitPair.lastPendingPaymentHash;
        }
    }


    /**
     * An internal support function for accounting
     */
    function accounting(address exitBooth, uint baseRoutePrice, bytes32 exitSecretHashed) internal{
        uint routePrice     = baseRoutePrice.mul(vehicleEntries[exitSecretHashed].multiplier);
        uint depositedWeis  = vehicleEntries[exitSecretHashed].depositedWeis;

        if(routePrice >= depositedWeis){
            asyncPayTo(getOwner(), depositedWeis);

            emit LogRoadExited(exitBooth, exitSecretHashed, depositedWeis, 0);
        }
        else{
            uint refundWeis = depositedWeis.sub(routePrice);
            asyncPayTo(getOwner(), routePrice);
            asyncPayTo(vehicleEntries[exitSecretHashed].vehicle, refundWeis);

            emit LogRoadExited(exitBooth, exitSecretHashed, routePrice, refundWeis);
        }

        delete vehicleEntries[exitSecretHashed].vehicle;
        //According to a provided exam truffle test
        //  tollBoothOperator_student.js
        //  this entry should not be deleted
        //delete vehicleEntries[exitSecretHashed].entryBooth;
        delete vehicleEntries[exitSecretHashed].multiplier;
        delete vehicleEntries[exitSecretHashed].depositedWeis;
        //Updating the vehicleEntry status is not necessary in this step, but being unambigious here
        vehicleEntries[exitSecretHashed].status = VehicleStatus.hasPaid;
    }


    /**
     * This function is commented out otherwise it prevents compilation of the completed contracts.
     * This function provides the same functionality with the eponymous function of `PullPaymentA`, which it
     * overrides, and to which it adds the following requirement:
     *     - It should roll back when the contract is in the `true` paused state.
     */
    function withdrawPayment() public whenNotPaused returns(bool success){
        return super.withdrawPayment();
    }
}